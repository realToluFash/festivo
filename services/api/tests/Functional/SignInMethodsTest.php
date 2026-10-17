<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailAddress;
use App\Entity\ProviderIdentity;
use App\Entity\RefreshToken;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Repository\ProviderIdentityRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;

final class SignInMethodsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADDRESS = 'folake@ire.events';

    /** @mago-expect lint:no-literal-password */
    private const string SECRET = 'JBSWY3DPEHPK3PXP';

    private const string WRONG = 'not my password at all';

    private User $user;

    /** A Google- or Apple-only account, when a test signs in as one instead. */
    private ?User $current = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime('2026-10-17 12:00:00');
        $this->user = self::service(UserRegistrar::class)->register(self::ADDRESS, 'Folake', self::PASSWORD)->user;
        $this->user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::onboard($this->user);
    }

    /** The point of linking from Settings: a Google account whose address is not the account's. */
    #[Test]
    public function googleLinksWithAnyAddressItVouchesFor(): void
    {
        $body = $this->link(IdentityProvider::Google, 'g-work', 'Folake.Adeyemi@gmail.com', $this->provedByPassword());

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        self::assertSame(['provider' => 'google', 'email' => 'folake.adeyemi@gmail.com'], $body);
        self::assertSame([['provider' => 'google', 'email' => 'folake.adeyemi@gmail.com']], $this->call('GET', '/api/auth/me')['providers']);
    }

    #[Test]
    public function appleLinksTheSameWay(): void
    {
        $this->link(IdentityProvider::Apple, 'a-relay', 'x7k2m9@privaterelay.appleid.com', $this->provedByPassword());

        self::assertSame(201, $this->statusCode());
        self::assertSame([['provider' => 'apple', 'email' => 'x7k2m9@privaterelay.appleid.com']], $this->call('GET', '/api/auth/me')['providers']);
    }

    /** NIST SP 800-63B: every verified address hears about a bound authenticator, with the device and the provider's address. */
    #[Test]
    public function linkingEmailsEveryVerifiedAddressAndIsAudited(): void
    {
        $this->addressOf('folake@personal.example', verified: true);
        $this->addressOf('unproved@example.com', verified: false);

        $this->link(IdentityProvider::Google, 'g-work', 'folake.adeyemi@gmail.com', $this->provedByPassword());

        $mails = $this->mails();
        self::assertSame([self::ADDRESS, 'folake@personal.example'], Vec\map($mails, static fn (Email $mail): string => $mail->getTo()[0]->getAddress()));
        self::assertSame('Google is now linked to your Soirely account', $mails[0]->getSubject());
        $text = (string) $mails[0]->getTextBody();
        self::assertStringContainsString('Google account: folake.adeyemi@gmail.com.', $text);
        self::assertStringContainsString('Firefox on macOS', $text);
        self::assertStringContainsString('/app/account/security', $text);

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'provider.linked']);
        self::assertNotNull($entry, 'the audit trail records it');
        self::assertTrue($this->user->getId()->equals($entry->subjectId()));
    }

    #[Test]
    public function aProviderAccountLinkedElsewhereIsRefusedAndNothingChanges(): void
    {
        $other = self::service(UserRegistrar::class)->register('someone@example.com', 'Bisi', self::PASSWORD)->user;
        self::em()->persist(new ProviderIdentity($other, IdentityProvider::Google, 'g-taken', 'bisi@gmail.com'));
        self::em()->flush();

        $body = $this->link(IdentityProvider::Google, 'g-taken', 'bisi@gmail.com', $this->provedByPassword());

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::ProviderTaken->type(), $body['type']);
        self::assertSame('google', $body['provider']);
        self::assertSame([], $this->call('GET', '/api/auth/me')['providers']);
        self::assertSame([], $this->mails(), 'nothing changed, so nobody is told');
    }

    #[Test]
    public function unlinkingWithAPasswordSetSignsOutWhatGoogleSignedIn(): void
    {
        $proof = $this->provedByPassword();
        $this->link(IdentityProvider::Google, 'g-work', 'folake.adeyemi@gmail.com', $proof);
        $byGoogle = $this->session(IdentityProvider::Google);
        $byPassword = $this->session(null);

        $body = $this->call('POST', '/api/auth/providers/google/unlink', ['proof' => $proof, 'sessionId' => $byGoogle->toRfc4122()]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['signedOut' => 1, 'thisDevice' => true], $body);
        self::assertSame('Google is no longer linked to your Soirely account', Iter\last($this->mails())?->getSubject());
        self::assertSame([], $this->call('GET', '/api/auth/me')['providers']);
        self::em()->clear();
        self::assertNotNull(self::em()->find(RefreshToken::class, $byGoogle)?->getRevokedAt());
        self::assertNull(self::em()->find(RefreshToken::class, $byPassword)?->getRevokedAt());

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'provider.unlinked']);
        self::assertSame(['provider' => ['google', null]], $entry?->changes(), 'before and after: it was there, and now is not');
    }

    /** The password the default line points at is not there to change. */
    #[Test]
    public function anAccountWithNoPasswordIsToldWhatItCanDo(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google]);
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();

        $this->link(IdentityProvider::Apple, 'a-kemi', 'kemi@icloud.com', $this->provedByGoogle());

        $text = (string) Iter\last($this->mails())?->getTextBody();
        self::assertStringContainsString("If this wasn't you, unlink Apple from Security and sign out any devices you don't recognise.", $text);
        self::assertStringNotContainsString('change your password', $text);
    }

    #[Test]
    public function theLastWayInCanNeverBeRemoved(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google]);

        $body = $this->call('POST', '/api/auth/providers/google/unlink', ['proof' => $this->provedByGoogle()], $user);

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::LastSignInMethod->type(), $body['type']);
        self::assertSame(1, self::service(ProviderIdentityRepository::class)->count(['user' => $user]));
    }

    #[Test]
    public function withAnotherProviderLinkedEitherMayGo(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google, IdentityProvider::Apple]);

        $this->call('POST', '/api/auth/providers/apple/unlink', ['proof' => $this->provedByGoogle()], $user);

        self::assertSame(200, $this->statusCode());
        self::assertSame([['provider' => 'google', 'email' => 'kemi@gmail.com']], $this->call('GET', '/api/auth/me', null, $user)['providers']);
    }

    #[Test]
    public function nothingChangesWithoutAProofFromTheLastFiveMinutes(): void
    {
        $this->link(IdentityProvider::Google, 'g-work', 'folake.adeyemi@gmail.com', null);
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::ProofRequired->type(), $this->last()['type']);

        $proof = $this->provedByPassword();
        self::mockTime('2026-10-17 12:04:59');
        $this->link(IdentityProvider::Google, 'g-work', 'folake.adeyemi@gmail.com', $proof);
        self::assertSame(201, $this->statusCode(), 'one proof covers several changes within its five minutes');

        self::mockTime('2026-10-17 12:05:00');
        $this->call('POST', '/api/auth/providers/google/unlink', ['proof' => $proof]);
        self::assertSame(ErrorCode::ProofRequired->type(), $this->last()['type'], 'and none after');
        self::assertCount(1, $this->call('GET', '/api/auth/me')['providers']);
    }

    #[Test]
    public function aWrongPasswordProvesNothing(): void
    {
        $body = $this->call('POST', '/api/auth/proof', ['password' => self::WRONG]);

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::InvalidCredentials->type(), $body['type']);
        self::assertArrayNotHasKey('proof', $body);
    }

    #[Test]
    public function aProofIsThisAccountsOnly(): void
    {
        $proof = $this->provedByPassword();
        $other = self::service(UserRegistrar::class)->register('someone@example.com', 'Bisi', self::PASSWORD)->user;
        self::onboard($other);

        $this->call('POST', '/api/auth/providers/google', ['proof' => $proof, 'providerSignIn' => ['idToken' => $this->googleToken('g-x', 'x@gmail.com')]], $other);

        self::assertSame(ErrorCode::ProofRequired->type(), $this->last()['type']);
    }

    /** Somebody else's Google account proves nothing about this one. */
    #[Test]
    public function onlyALinkedProviderProvesItIsYou(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google]);

        $body = $this->call('POST', '/api/auth/proof', ['provider' => 'google', 'providerSignIn' => ['idToken' => $this->googleToken('g-stranger', 'stranger@gmail.com')]], $user);

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::InvalidCredentials->type(), $body['type']);
    }

    #[Test]
    public function aProviderSignInOlderThanFiveMinutesProvesNothing(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google]);

        $body = $this->call('POST', '/api/auth/proof', ['provider' => 'google', 'providerSignIn' => ['idToken' => $this->googleToken('g-kemi', 'kemi@gmail.com', '-6 minutes')]], $user);

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::InvalidCredentials->type(), $body['type']);
        self::assertArrayNotHasKey('proof', $body);
    }

    #[Test]
    public function withTwoFactorOnTheCodeIsAskedForToo(): void
    {
        $factor = new TwoFactorFactor($this->user, self::service(SecretBox::class)->seal(self::SECRET));
        $factor->activate(new Clock()->now());
        self::em()->persist($factor);
        self::em()->flush();

        $this->call('POST', '/api/auth/proof', ['password' => self::PASSWORD]);
        self::assertSame(ErrorCode::TwoFactorRequired->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/proof', ['password' => self::PASSWORD, 'code' => '000000']);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type']);

        $body = $this->call('POST', '/api/auth/proof', ['password' => self::PASSWORD, 'code' => $this->codeNow()]);
        self::assertIsString($body['proof'] ?? null, Json\encode($body));
    }

    /** A provider's sign-in is single-use (RFC 6749 §4.1.2), so a mistyped code is retried against the kept one. */
    #[Test]
    public function aWrongCodeAfterGoogleIsRetriedWithoutGoingBack(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google]);
        $this->twoFactorFor($user);

        $refused = $this->call('POST', '/api/auth/proof', ['provider' => 'google', 'providerSignIn' => ['idToken' => $this->googleToken('g-kemi', 'kemi@gmail.com')], 'code' => '000000']);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $refused['type']);
        $pending = Type\string()->coerce($refused['pendingProof']);

        $this->link(IdentityProvider::Apple, 'a-kemi', 'kemi@icloud.com', $pending);
        self::assertSame(403, $this->statusCode(), 'it stands for nothing until the code passes');

        $body = $this->call('POST', '/api/auth/proof', ['pendingProof' => $pending, 'code' => $this->codeNow()]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $this->link(IdentityProvider::Apple, 'a-kemi', 'kemi@icloud.com', Type\string()->coerce($body['proof']));
        self::assertSame(201, $this->statusCode());

        $this->call('POST', '/api/auth/proof', ['pendingProof' => $pending, 'code' => $this->codeNow()]);
        self::assertSame(ErrorCode::ProofRequired->type(), $this->last()['type'], 'spent once it passes');
    }

    #[Test]
    public function aKeptSignInLapsesWithTheFiveMinutes(): void
    {
        $user = $this->providerOnly([IdentityProvider::Google]);
        $this->twoFactorFor($user);

        $refused = $this->call('POST', '/api/auth/proof', ['provider' => 'google', 'providerSignIn' => ['idToken' => $this->googleToken('g-kemi', 'kemi@gmail.com')]]);
        self::assertSame(ErrorCode::TwoFactorRequired->type(), $refused['type']);

        self::mockTime('+5 minutes');
        $body = $this->call('POST', '/api/auth/proof', ['pendingProof' => $refused['pendingProof'], 'code' => $this->codeNow()]);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::ProofRequired->type(), $body['type']);
        self::assertSame('This needs your password, or a sign-in with Google or Apple, in the last 5 minutes, and your two-factor code if two-factor is on.', $body['detail']);
    }

    /** sc-58 and sc-59 untouched, and the session they start now says which provider started it. */
    #[Test]
    public function signingInWithAProviderRecordsItOnTheSession(): void
    {
        $this->client->request('POST', '/api/auth/oauth/google', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'idToken' => $this->googleToken('g-new', 'new.person@example.com'),
        ]));
        $body = $this->last();

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        $session = self::em()->find(RefreshToken::class, Uuid::fromString(Type\string()->coerce($body['sessionId'])));
        self::assertSame(IdentityProvider::Google, $session?->getSignedInWith());
    }

    private function twoFactorFor(User $user): void
    {
        $factor = new TwoFactorFactor($user, self::service(SecretBox::class)->seal(self::SECRET));
        $factor->activate(new Clock()->now());
        self::em()->persist($factor);
        self::em()->flush();
    }

    private function provedByPassword(): string
    {
        $body = $this->call('POST', '/api/auth/proof', ['password' => self::PASSWORD]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame('2026-10-17T12:05:00+00:00', $body['expiresAt']);

        return Type\string()->coerce($body['proof']);
    }

    private function provedByGoogle(): string
    {
        $body = $this->call('POST', '/api/auth/proof', ['provider' => 'google', 'providerSignIn' => ['idToken' => $this->googleToken('g-kemi', 'kemi@gmail.com')]]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['proof']);
    }

    /** @param list<IdentityProvider> $providers */
    private function providerOnly(array $providers): User
    {
        $user = self::service(UserRegistrar::class)->registerFromProvider('kemi@example.com', 'Kemi')->user;
        self::onboard($user);

        foreach ($providers as $provider) {
            self::em()->persist(new ProviderIdentity($user, $provider, IdentityProvider::Google === $provider ? 'g-kemi' : 'a-kemi', IdentityProvider::Google === $provider ? 'kemi@gmail.com' : 'kemi@icloud.com'));
        }

        self::em()->flush();
        $this->current = $user;

        return $user;
    }

    /** @return array<string, mixed> */
    private function link(IdentityProvider $provider, string $subject, string $email, #[SensitiveParameter] ?string $proof): array
    {
        $token = IdentityProvider::Google === $provider ? $this->googleToken($subject, $email) : $this->appleToken($subject, $email);

        return $this->call('POST', '/api/auth/providers/' . $provider->value, ['proof' => $proof, 'providerSignIn' => ['idToken' => $token]]);
    }

    private function session(?IdentityProvider $signedInWith): Uuid
    {
        $user = Type\instance_of(User::class)->coerce(self::em()->find(User::class, $this->user->getId()));
        $tokens = self::service(TokenIssuer::class)->issueFor($user, null, $signedInWith);
        self::em()->flush();

        return $tokens->sessionId;
    }

    private function addressOf(string $address, bool $verified): void
    {
        $email = new EmailAddress($this->user, Type\non_empty_string()->assert($address));
        $email->setVerifiedAt($verified ? new DateTimeImmutable() : null);
        self::em()->persist($email);
        self::em()->flush();
    }

    /** @return list<Email> the link and unlink emails, leaving out registration's codes */
    private function mails(): array
    {
        return Vec\map(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), 'linked'),
        ), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message));
    }

    private function codeNow(): string
    {
        return TOTP::createFromSecret(self::SECRET)->at(Type\uint()->coerce(new Clock()->now()->getTimestamp()));
    }

    private function googleToken(string $subject, string $email, string $signedIn = '-1 minute'): string
    {
        return $this->signed('GOOGLE', $subject, $email, $signedIn);
    }

    private function appleToken(string $subject, string $email): string
    {
        return $this->signed('APPLE', $subject, $email);
    }

    private function signed(string $provider, string $subject, string $email, string $signedIn = '-1 minute'): string
    {
        $configured = static fn (string $name): string => Str\trim(Str\split(Type\string()->coerce($_SERVER[$name] ?? $_ENV[$name] ?? ''), ',')[0] ?? '');

        return self::service(TestSigningKeys::class)->sign([
            'iss' => $configured('OAUTH_' . $provider . '_ISSUERS'),
            'aud' => $configured('OAUTH_' . $provider . '_CLIENT_IDS'),
            'iat' => new Clock()->now()->modify($signedIn),
            'exp' => new Clock()->now()->modify('+1 hour'),
            'sub' => $subject,
            'email' => $email,
            'email_verified' => true,
        ]);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null, ?User $as = null): array
    {
        $who = self::em()->find(User::class, ($as ?? $this->current ?? $this->user)->getId());
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_USER_AGENT' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create(Type\instance_of(User::class)->coerce($who)),
        ], content: Json\encode($body ?? new stdClass()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
