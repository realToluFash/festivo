<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Controller\VerificationController;
use App\Domain\User\Verification\EmailAddressVerifier;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeMailer;
use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\EmailAddressRepository;
use App\Repository\VerificationChallengeRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Mime\Email;

final class VerifyEmailTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function registeringSendsACodeToTheAddress(): void
    {
        $this->register('sent@example.com');

        $mail = self::getMailerMessage();

        self::assertInstanceOf(Email::class, $mail, 'registration sends nothing to the address it was given');
        self::assertSame('sent@example.com', $mail->getTo()[0]->getAddress());
        self::assertStringContainsString('Confirm your email address', (string) $mail->getSubject());
        self::assertMatchesRegularExpression('/\d{6}/', (string) $mail->getTextBody());
    }

    #[Test]
    public function theCodeIsStoredHashedAndNeverInThePlain(): void
    {
        $token = $this->register('hashed@example.com');
        $code = $this->codeFor('hashed@example.com');

        $challenge = $this->challengeFor('hashed@example.com');

        self::assertNotNull($challenge);
        self::assertSame(VerificationCodeIssuer::hash($code), $challenge->getCodeHash());
        self::assertStringNotContainsString($code, $challenge->getCodeHash());
        self::assertNotSame('', $token);
    }

    #[Test]
    public function theRightCodeVerifiesTheAddress(): void
    {
        $token = $this->register('verifies@example.com');

        $body = $this->verify($token, $this->codeFor('verifies@example.com'));

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertTrue($body['verified']);
        self::assertSame('verifies@example.com', $body['address']);
        self::assertNotNull($this->addressFor('verifies@example.com')->getVerifiedAt());
    }

    #[Test]
    public function verifyingDoesNotIssueNewTokens(): void
    {
        $token = $this->register('tokens@example.com');
        $before = $this->sessionCount();

        $this->verify($token, $this->codeFor('tokens@example.com'));

        self::assertSame($before, $this->sessionCount(), 'a refresh token was issued by verifying');
        self::assertArrayNotHasKey('accessToken', Json\typed(
            (string) $this->client->getResponse()->getContent(),
            Type\dict(Type\string(), Type\mixed()),
        ));
    }

    #[Test]
    public function aWrongCodeIsRefusedAndTheAddressStaysUnverified(): void
    {
        $token = $this->register('wrong@example.com');

        $this->verify($token, '000000');

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(
            'https://soirely.com/errors/verification_code_invalid',
            $this->body()['type'],
        );
        self::assertNull($this->addressFor('wrong@example.com')->getVerifiedAt());
    }

    #[Test]
    public function tooManyWrongCodesKillTheChallengeEntirely(): void
    {
        $token = $this->register('exhausted@example.com');
        $code = $this->codeFor('exhausted@example.com');

        for ($attempt = 0; $attempt < VerificationChallenge::MAXIMUM_ATTEMPTS; ++$attempt) {
            $this->verify($token, '000000');
        }

        self::assertSame(
            'https://soirely.com/errors/verification_code_exhausted',
            $this->body()['type'],
        );

        $this->verify($token, $code);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertNull($this->addressFor('exhausted@example.com')->getVerifiedAt());
    }

    #[Test]
    public function anExpiredCodeSaysSoRatherThanJustFailing(): void
    {
        $token = $this->register('expired@example.com');
        $code = $this->codeFor('expired@example.com');

        $challenge = $this->challengeFor('expired@example.com');
        self::assertNotNull($challenge);

        $this->entityManager()->getConnection()->executeStatement(
            'UPDATE verification_challenges SET expires_at = :past WHERE id = :id',
            ['past' => new DateTimeImmutable('-1 minute')->format('Y-m-d H:i:s'), 'id' => $challenge->getId()->toRfc4122()],
        );
        $this->entityManager()->clear();

        $this->verify($token, $code);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(
            'https://soirely.com/errors/verification_code_expired',
            $this->body()['type'],
        );
    }

    #[Test]
    public function verifyingAnAlreadyVerifiedAddressSucceeds(): void
    {
        $token = $this->register('twice@example.com');
        $code = $this->codeFor('twice@example.com');

        $this->verify($token, $code);
        $body = $this->verify($token, $code);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertTrue($body['verified']);
    }

    #[Test]
    public function resendingIssuesAFreshCodeAndRetiresTheOldOne(): void
    {
        $token = $this->register('resend@example.com');
        $first = $this->codeFor('resend@example.com');

        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(200, $this->client->getResponse()->getStatusCode());

        $second = $this->codeFor('resend@example.com');
        self::assertNotSame($first, $second, 'the same code was sent again');

        $this->verify($token, $first);
        self::assertSame(422, $this->client->getResponse()->getStatusCode(), 'the retired code still works');

        $this->verify($token, $second);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function aResendAnswersWithTheSecondsUntilTheNextOne(): void
    {
        $token = $this->register('cooldown@example.com');

        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));

        $seconds = $this->body()['cooldownSeconds'];

        self::assertIsInt($seconds);
        self::assertGreaterThan(0, $seconds);
        self::assertLessThanOrEqual(VerificationChallenge::RESEND_COOLDOWN_SECONDS, $seconds);
    }

    /** Over HTTP it cannot be exhausted: `framework.test` resets the budget every request. */
    #[Test]
    public function aResendInsideTheCooldownIsRefusedWithTheTimeLeft(): void
    {
        $token = $this->register('second@example.com');
        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));

        $controller = new VerificationController(
            self::serviceById(Security::class, Security::class),
            self::serviceById(EmailAddressVerifier::class, EmailAddressVerifier::class),
            self::serviceById(VerificationCodeIssuer::class, VerificationCodeIssuer::class),
            self::serviceById(VerificationCodeMailer::class, VerificationCodeMailer::class),
            new RefusingRateLimiterFactory(),
            $this->entityManager(),
        );

        try {
            $controller->resend();
            self::fail('the endpoint sent a second code inside the cooldown');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode);
            self::assertArrayHasKey('Retry-After', $e->headers);
        }
    }

    #[Test]
    public function verifyingNeedsAnAccount(): void
    {
        $this->client->request(
            'POST',
            '/api/auth/verify/email',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: Json\encode(['code' => '123456']),
        );

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
    }

    /** @return array<string, mixed> */
    private function verify(#[SensitiveParameter] string $token, string $code): array
    {
        $this->client->request(
            'POST',
            '/api/auth/verify/email',
            server: $this->authenticated($token),
            content: Json\encode(['code' => $code]),
        );

        return $this->body();
    }

    private function register(string $address): string
    {
        $this->client->request(
            'POST',
            '/api/auth/register',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: Json\encode([
                'email' => $address,
                'name' => 'Ada Lovelace',
                'password' => self::PASSWORD,
            ]),
        );

        return Type\string()->coerce($this->body()['accessToken']);
    }

    /** @return array<string, string> */
    private function authenticated(#[SensitiveParameter] string $token): array
    {
        return ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer ' . $token];
    }

    private function codeFor(string $address): string
    {
        foreach (Vec\reverse(self::getMailerMessages()) as $message) {
            if (!$message instanceof Email || $message->getTo()[0]->getAddress() !== $address) {
                continue;
            }

            return Regex\first_match((string) $message->getTextBody(), '/(\d{6})/')[1] ?? '';
        }

        self::fail("nothing was emailed to {$address}");
    }

    private function challengeFor(string $address): ?VerificationChallenge
    {
        return self::serviceById(VerificationChallengeRepository::class, VerificationChallengeRepository::class)
            ->findLiveFor($this->addressFor($address));
    }

    private function addressFor(string $address): EmailAddress
    {
        $found = self::serviceById(EmailAddressRepository::class, EmailAddressRepository::class)
            ->findOneByAddress($address);

        self::assertNotNull($found);

        return $found;
    }

    private function sessionCount(): int
    {
        return (int) $this->entityManager()->getConnection()
            ->fetchOne('SELECT COUNT(*) FROM refresh_tokens');
    }

    private function entityManager(): EntityManagerInterface
    {
        return self::serviceById(EntityManagerInterface::class, EntityManagerInterface::class);
    }

    /** @return array<string, mixed> */
    private function body(): array
    {
        return Json\typed(
            (string) $this->client->getResponse()->getContent(),
            Type\dict(Type\string(), Type\mixed()),
        );
    }
}
