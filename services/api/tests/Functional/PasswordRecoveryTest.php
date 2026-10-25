<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Controller\PasswordRecoveryController;
use App\Domain\User\Http\SignInResponse;
use App\Domain\User\Recovery\PasswordRecovery;
use App\Domain\User\UserRegistrar;
use App\Entity\PasswordResetToken;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\AfterResponse;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Repository\PasswordResetTokenRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mailer\EventListener\MessageLoggerListener;
use Symfony\Component\Mime\Email;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

final class PasswordRecoveryTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string OLD_PASSWORD = 'the old passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string NEW_PASSWORD = 'a brand new passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string ANOTHER_PASSWORD = 'yet another passphrase';

    private const string TOO_SHORT = 'short';

    /** @mago-expect lint:no-literal-password */
    private const string UNKNOWN_TOKEN = 'not-a-real-token';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    #[Test]
    public function aRegisteredAddressIsSentASingleUseLink(): void
    {
        $this->account('folake@example.com');

        $this->call('POST', '/api/auth/password/forgot', ['email' => 'Folake@Example.com']);

        self::assertSame(202, $this->statusCode());
        self::assertSame('{}', $this->raw());
        self::assertSame('folake@example.com', $this->lastEmail()->getTo()[0]->getAddress());
        self::assertNotSame('', $this->linkToken());
    }

    /** Byte for byte the same, so the endpoint cannot be used to find out who has an account. */
    #[Test]
    public function anUnknownAddressGetsTheIdenticalAnswerAndNothingIsSent(): void
    {
        $this->account('folake@example.com');
        $this->call('POST', '/api/auth/password/forgot', ['email' => 'folake@example.com']);
        $known = [$this->statusCode(), $this->raw()];
        self::assertNotEmpty(self::getMailerMessages(), 'the account was sent its link');

        $this->call('POST', '/api/auth/password/forgot', ['email' => 'nobody@example.com']);

        self::assertSame($known, [$this->statusCode(), $this->raw()]);
        self::assertCount(0, self::getMailerMessages(), 'nothing was sent for an address with no account');
    }

    #[Test]
    public function anAccountWithNoPasswordIsToldHowItSignsInInstead(): void
    {
        $user = $this->account('google@example.com');
        $user->setPassword(null);
        self::service(EntityManagerInterface::class)->persist(new ProviderIdentity($user, IdentityProvider::Google, 'g-1'));
        self::service(EntityManagerInterface::class)->flush();

        $this->call('POST', '/api/auth/password/forgot', ['email' => 'google@example.com']);

        self::assertSame(202, $this->statusCode());
        $body = (string) $this->lastEmail()->getTextBody();
        self::assertStringContainsString('you sign in with Google', $body);
        self::assertStringNotContainsString('reset-password?token=', $body);
    }

    #[Test]
    public function theLinkSaysWhoseItIsAndSetsANewPasswordSigningEveryOtherDeviceOut(): void
    {
        $this->account('folake@example.com');
        $elsewhere = $this->signIn('folake@example.com', self::OLD_PASSWORD);
        $token = $this->requestLink('folake@example.com');

        self::assertSame(['email' => 'folake@example.com', 'twoFactor' => false], $this->call('POST', '/api/auth/password/reset/check', ['token' => $token]));

        $body = $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::NEW_PASSWORD]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['accessToken'] ?? null, 'this device is signed in');
        self::assertStringContainsString('was changed on', (string) $this->lastEmail()->getTextBody());

        $this->call('POST', '/api/auth/refresh', ['refreshToken' => $elsewhere]);
        self::assertSame(401, $this->statusCode(), 'the other device is signed out');

        $this->call('POST', '/api/auth/login', ['email' => 'folake@example.com', 'password' => self::OLD_PASSWORD]);
        self::assertSame(401, $this->statusCode(), 'the old password no longer works');
        $this->call('POST', '/api/auth/login', ['email' => 'folake@example.com', 'password' => self::NEW_PASSWORD]);
        self::assertSame(200, $this->statusCode(), 'the new one does');
    }

    #[Test]
    public function aLinkWorksOnceAndThenSaysSo(): void
    {
        $this->account('folake@example.com');
        $token = $this->requestLink('folake@example.com');
        $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::NEW_PASSWORD]);

        $this->call('POST', '/api/auth/password/reset/check', ['token' => $token]);
        self::assertSame(410, $this->statusCode());
        self::assertSame(ErrorCode::ResetLinkUsed->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::ANOTHER_PASSWORD]);
        self::assertSame(ErrorCode::ResetLinkUsed->type(), $this->last()['type']);
    }

    #[Test]
    public function anExpiredLinkSaysSoAndOutlivesNoVerificationCode(): void
    {
        self::assertLessThan(VerificationChallenge::LIFETIME_MINUTES, PasswordResetToken::LIFETIME_MINUTES);

        $this->account('folake@example.com');
        $token = $this->requestLink('folake@example.com');
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(
            "UPDATE password_reset_tokens SET expires_at = NOW() - interval '1 minute'",
        );
        self::service(EntityManagerInterface::class)->clear();

        $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::NEW_PASSWORD]);

        self::assertSame(410, $this->statusCode());
        self::assertSame(ErrorCode::ResetLinkExpired->type(), $this->last()['type']);
    }

    #[Test]
    public function aLinkSoirelyNeverSentIsNotFound(): void
    {
        $this->call('POST', '/api/auth/password/reset/check', ['token' => self::UNKNOWN_TOKEN]);

        self::assertSame(404, $this->statusCode());
        self::assertSame(ErrorCode::ResetLinkInvalid->type(), $this->last()['type']);
    }

    /** The same rules as registration, and a refusal changes nothing: the link and the old password both still work. */
    #[Test]
    public function aPasswordTheRulesRefuseLeavesTheLinkUsable(): void
    {
        $this->account('folake@example.com');
        $token = $this->requestLink('folake@example.com');

        $body = $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::TOO_SHORT]);

        self::assertSame(422, $this->statusCode());
        $violations = Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']);
        self::assertSame('password', $violations[0]['propertyPath']);

        $this->call('POST', '/api/auth/password/reset/check', ['token' => $token]);
        self::assertSame(200, $this->statusCode(), 'the link still works');
        $this->call('POST', '/api/auth/login', ['email' => 'folake@example.com', 'password' => self::OLD_PASSWORD]);
        self::assertSame(200, $this->statusCode(), 'and so does the old password');
    }

    /** Every address costs the request the same: the lookup and the email wait until the answer has gone. */
    #[Test]
    public function theAnswerIsSentBeforeTheAddressIsLookedUpOrMailed(): void
    {
        $this->account('folake@example.com');
        $controller = new PasswordRecoveryController(
            self::service(PasswordRecovery::class),
            self::service(AfterResponse::class),
            self::service(SignInResponse::class),
            self::serviceById('limiter.password_reset_address', RateLimiterFactoryInterface::class),
            self::serviceById('limiter.password_reset_ip', RateLimiterFactoryInterface::class),
            self::service(CodeField::class),
        );
        $sent = self::serviceById('mailer.message_logger_listener', MessageLoggerListener::class);
        $before = Iter\count($sent->getEvents()->getMessages());

        $response = $controller->forgot(Request::create('/api/auth/password/forgot', 'POST', content: Json\encode(['email' => 'folake@example.com'])));

        self::assertSame(202, $response->getStatusCode());
        self::assertCount($before, $sent->getEvents()->getMessages(), 'nothing is mailed while the answer is being made');
        self::assertSame(0, self::service(PasswordResetTokenRepository::class)->count([]), 'nor is a link made');

        self::service(AfterResponse::class)->run();

        self::assertCount($before + 1, $sent->getEvents()->getMessages(), 'the link goes once the answer has');
    }

    /** An account with no language of its own hears in the one it asked in, dates included. */
    #[Test]
    public function theEmailsAreInTheLanguageTheResetWasAskedIn(): void
    {
        $this->account('folake@example.com');
        $this->client->setServerParameter('HTTP_ACCEPT_LANGUAGE', 'fr');

        $token = $this->requestLink('folake@example.com');
        self::assertSame('Choisissez un nouveau mot de passe Soirely', $this->lastEmail()->getSubject());

        $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::NEW_PASSWORD]);
        $changed = $this->lastEmail();
        self::assertSame('Votre mot de passe Soirely a été changé', $changed->getSubject());
        self::assertMatchesRegularExpression('/\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/', (string) $changed->getTextBody(), 'the date in French too');
    }

    /** Either budget spent refuses with a time, and says nothing about whether the address has an account. */
    #[Test]
    public function aSpentBudgetIsRefusedWithATime(): void
    {
        $open = self::serviceById('limiter.password_reset_ip', RateLimiterFactoryInterface::class);

        foreach ([[new RefusingRateLimiterFactory(), $open], [$open, new RefusingRateLimiterFactory()]] as [$address, $ip]) {
            $controller = new PasswordRecoveryController(self::service(PasswordRecovery::class), self::service(AfterResponse::class), self::service(SignInResponse::class), $address, $ip, self::service(CodeField::class));

            try {
                $controller->forgot(Request::create('/api/auth/password/forgot', 'POST', content: Json\encode(['email' => 'anybody@example.com'])));
                self::fail('a request with no budget left was accepted');
            } catch (ApiException $e) {
                self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode);
                self::assertArrayHasKey('Retry-After', $e->headers);
                self::assertMatchesRegularExpression('/Try again at \d\d:\d\d\./', self::worded($e));
            }
        }
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Folake', self::OLD_PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    private function signIn(string $email, #[SensitiveParameter] string $password): string
    {
        $body = $this->call('POST', '/api/auth/login', ['email' => $email, 'password' => $password]);

        return Type\string()->coerce($body['refreshToken'] ?? null);
    }

    private function requestLink(string $email): string
    {
        $this->call('POST', '/api/auth/password/forgot', ['email' => $email]);

        return $this->linkToken();
    }

    private function linkToken(): string
    {
        return Regex\first_match((string) $this->lastEmail()->getTextBody(), '/reset-password\?token=([0-9a-f]+)/')[1] ?? '';
    }

    private function lastEmail(): Email
    {
        return Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, array $body): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = $this->raw();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function raw(): string
    {
        return (string) $this->client->getResponse()->getContent();
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
