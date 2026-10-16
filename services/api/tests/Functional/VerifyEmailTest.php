<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Verification\ContactVerifier;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeResender;
use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\EmailAddressRepository;
use App\Repository\VerificationChallengeRepository;
use App\Tests\ApiTestCase;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;

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
    public function anExhaustedCodeSaysSoOnEveryLaterTryUntilANewOneIsSent(): void
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

        foreach (['000000', $code] as $later) {
            $this->verify($token, $later);

            self::assertSame(
                'https://soirely.com/errors/verification_code_exhausted',
                $this->body()['type'],
                'a spent code must keep saying it is spent, the right one included',
            );
        }

        self::assertNull($this->addressFor('exhausted@example.com')->getVerifiedAt());

        $this->endCooldownFor('exhausted@example.com');
        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));
        $this->verify($token, $this->codeFor('exhausted@example.com'));

        self::assertSame(200, $this->client->getResponse()->getStatusCode(), 'the code in the newest email did not work');
    }

    /** Resends sent at once each left a live code, and wrong tries spread across them past the limit. */
    #[Test]
    public function theDatabaseHoldsAtMostOneLiveCodePerAddress(): void
    {
        $this->register('one-live@example.com');

        $this->expectException(UniqueConstraintViolationException::class);

        $this->entityManager()->getConnection()->executeStatement(
            <<<'SQL'
                INSERT INTO verification_challenges
                    (id, channel, email_address_id, code_hash, expires_at, attempts, created_at, updated_at)
                VALUES (:id, 'email', :address, :hash, NOW(), 0, NOW(), NOW())
                SQL,
            [
                'id' => Uuid::v7()->toRfc4122(),
                'address' => $this->addressFor('one-live@example.com')->getId()->toRfc4122(),
                'hash' => VerificationCodeIssuer::hash('123456'),
            ],
        );
    }

    /** Two wrong codes at once each read the same count; the database adds, so neither is lost. */
    #[Test]
    public function aWrongCodeCountsAgainstTheStoredAttemptsNotAStaleCopy(): void
    {
        $this->register('stale@example.com');
        $address = $this->addressFor('stale@example.com');
        self::assertNotNull($this->challengeFor('stale@example.com'));

        $this->entityManager()->getConnection()->executeStatement(
            'UPDATE verification_challenges SET attempts = :spent WHERE email_address_id = :address',
            ['spent' => VerificationChallenge::MAXIMUM_ATTEMPTS - 1, 'address' => $address->getId()->toRfc4122()],
        );

        try {
            self::serviceById(ContactVerifier::class, ContactVerifier::class)->verify($address, '000000');
            self::fail('a wrong code was accepted');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::VerificationCodeExhausted, $e->errorCode);
        }
    }

    /** The second of two right codes sent at once holds the address as it was before the first one landed. */
    #[Test]
    public function aRightCodeArrivingAfterAnotherFindsTheAddressVerified(): void
    {
        $this->register('twice-at-once@example.com');
        $code = $this->codeFor('twice-at-once@example.com');
        $stale = $this->addressFor('twice-at-once@example.com');

        $this->landedElsewhere($stale, 'UPDATE email_addresses SET verified_at = NOW() WHERE id = :address');
        $this->landedElsewhere($stale, 'UPDATE verification_challenges SET revoked_at = NOW() WHERE email_address_id = :address');

        $refusal = self::serviceById(ContactVerifier::class, ContactVerifier::class)->attempt($stale, $code);

        self::assertNull($refusal, 'a second device was told its right code was wrong');
        self::assertTrue($stale->isVerified());
    }

    #[Test]
    public function aResendAfterAVerificationThatJustLandedSendsNothing(): void
    {
        $this->register('verified-meanwhile@example.com');
        $this->endCooldownFor('verified-meanwhile@example.com');
        $stale = $this->addressFor('verified-meanwhile@example.com');

        $this->landedElsewhere($stale, 'UPDATE email_addresses SET verified_at = NOW() WHERE id = :address');

        $outcome = self::serviceById(VerificationCodeResender::class, VerificationCodeResender::class)->resend($stale);

        self::assertSame(0, $outcome, 'a code was issued for an address already verified');
    }

    #[Test]
    public function anEmptyCodeCostsNoAttempt(): void
    {
        $token = $this->register('empty@example.com');

        $this->verify($token, '  ');

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(0, $this->challengeFor('empty@example.com')?->getAttempts());
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
        $this->endCooldownFor('resend@example.com');

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
        $this->endCooldownFor('cooldown@example.com');

        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame(VerificationChallenge::RESEND_COOLDOWN_SECONDS, $this->body()['cooldownSeconds']);
    }

    #[Test]
    public function theRegistrationEmailStartsTheCooldown(): void
    {
        $token = $this->register('fresh@example.com');

        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(429, $this->client->getResponse()->getStatusCode(), 'a second code was sent straight after registering');
        $left = (int) $this->client->getResponse()->headers->get('Retry-After');
        self::assertGreaterThan(0, $left);
        self::assertLessThanOrEqual(VerificationChallenge::RESEND_COOLDOWN_SECONDS, $left);
    }

    #[Test]
    public function aResendInsideTheCooldownIsRefusedWithTheTimeLeft(): void
    {
        $token = $this->register('second@example.com');
        $this->endCooldownFor('second@example.com');
        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));
        self::assertCount(1, self::getMailerMessages());

        $this->client->request('POST', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(429, $this->client->getResponse()->getStatusCode());
        self::assertSame(
            'https://soirely.com/errors/too_many_attempts',
            $this->body()['type'],
        );
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));
        self::assertCount(0, self::getMailerMessages(), 'a refused resend still sent a code');
    }

    #[Test]
    public function theCooldownCanBeReadWithoutSpendingIt(): void
    {
        $token = $this->register('reads@example.com');

        $this->client->request('GET', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        $left = $this->body()['cooldownSeconds'];
        self::assertIsInt($left);
        self::assertGreaterThan(0, $left);

        $this->endCooldownFor('reads@example.com');
        $this->client->request('GET', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(0, $this->body()['cooldownSeconds']);
        self::assertCount(0, self::getMailerMessages(), 'reading the cooldown sent a code');
    }

    #[Test]
    public function aVerifiedAddressHasNoCooldown(): void
    {
        $token = $this->register('done@example.com');
        $this->verify($token, $this->codeFor('done@example.com'));

        $this->client->request('GET', '/api/auth/verify/resend', server: $this->authenticated($token));

        self::assertSame(0, $this->body()['cooldownSeconds']);
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

    /** As if the newest code went out a cooldown ago. */
    private function endCooldownFor(string $address): void
    {
        $this->entityManager()->getConnection()->executeStatement(
            'UPDATE verification_challenges SET created_at = :then WHERE email_address_id = :address',
            [
                'then' => new DateTimeImmutable(Str\format('-%d seconds', VerificationChallenge::RESEND_COOLDOWN_SECONDS + 1))->format('Y-m-d H:i:s'),
                'address' => $this->addressFor($address)->getId()->toRfc4122(),
            ],
        );
        $this->entityManager()->clear();
    }

    /** Another request's commit, made behind the back of the entity this test holds. */
    private function landedElsewhere(EmailAddress $address, string $sql): void
    {
        $this->entityManager()->getConnection()->executeStatement($sql, ['address' => $address->getId()->toRfc4122()]);
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
