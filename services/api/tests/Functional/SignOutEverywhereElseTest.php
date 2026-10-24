<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\RecoveryCodes;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Repository\RecoveryCodeRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

final class SignOutEverywhereElseTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string SECRET = 'JBSWY3DPEHPK3PXP';

    private const string WRONG = 'not my password at all';

    #[Test]
    public function everyOtherDeviceIsRefusedAtOnceAndThisOneCarriesOn(): void
    {
        $this->account('lost@example.com');
        $laptop = $this->signIn('lost@example.com');
        $phone = $this->signIn('lost@example.com');
        $tablet = $this->signIn('lost@example.com');

        $body = $this->signOutOthers($laptop, $this->proved($laptop));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['signedOut' => 3, 'thisDevice' => false], $body, "registering's own session, the phone's and the tablet's");
        self::assertSame(401, $this->me($phone['accessToken']));
        self::assertSame(401, $this->me($tablet['accessToken']));
        self::assertSame(200, $this->me($laptop['accessToken']));

        $listed = Type\shape(['sessions' => Type\vec(Type\shape(['id' => Type\string()], true))])
            ->coerce($this->call('GET', '/api/auth/sessions', $laptop['accessToken']));
        self::assertSame([$laptop['sessionId']], [$listed['sessions'][0]['id']]);
        self::assertCount(1, $listed['sessions']);
    }

    #[Test]
    public function withoutASessionIdEverySessionEndsTheCallersToo(): void
    {
        $this->account('self@example.com');
        $laptop = $this->signIn('self@example.com');
        $phone = $this->signIn('self@example.com');
        $proof = $this->proved($laptop);

        $body = $this->call('POST', '/api/auth/sessions/others', $laptop['accessToken'], ['proof' => $proof]);

        self::assertSame(['signedOut' => 3, 'thisDevice' => true], $body);
        self::assertSame(401, $this->me($phone['accessToken']));
        self::assertSame(401, $this->me($laptop['accessToken']));
    }

    /** The client names a session it does not hold: it is told the truth, that this device is signed out too. */
    #[Test]
    public function namingAnotherSessionOfThisAccountSaysThisDeviceEnds(): void
    {
        $this->account('stale@example.com');
        $laptop = $this->signIn('stale@example.com');
        $phone = $this->signIn('stale@example.com');

        $body = $this->call('POST', '/api/auth/sessions/others', $laptop['accessToken'], [
            'proof' => $this->proved($laptop),
            'sessionId' => $phone['sessionId'],
        ]);

        self::assertSame(['signedOut' => 2, 'thisDevice' => true], $body, "registering's own session and the laptop's");
        self::assertSame(401, $this->me($laptop['accessToken']));
        self::assertSame(200, $this->me($phone['accessToken']));
    }

    #[Test]
    public function withoutAProofNothingIsRevoked(): void
    {
        $this->account('unproved@example.com');
        $laptop = $this->signIn('unproved@example.com');
        $phone = $this->signIn('unproved@example.com');

        $missing = $this->signOutOthers($laptop, null);
        self::assertSame(ErrorCode::ProofRequired->type(), $missing['type']);

        $forged = $this->signOutOthers($laptop, 'not-a-proof');
        self::assertSame(ErrorCode::ProofRequired->type(), $forged['type']);

        self::assertSame(200, $this->me($phone['accessToken']));
        self::assertNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'sessions.signed_out_elsewhere']));
    }

    #[Test]
    public function aWrongPasswordIsRefusedAndRevokesNothing(): void
    {
        $this->account('wrong@example.com');
        $laptop = $this->signIn('wrong@example.com');
        $phone = $this->signIn('wrong@example.com');

        $body = $this->call('POST', '/api/auth/proof', $laptop['accessToken'], ['password' => self::WRONG]);

        self::assertSame(ErrorCode::InvalidCredentials->type(), $body['type']);
        self::assertSame(200, $this->me($phone['accessToken']));
    }

    #[Test]
    public function aSecondCallFindsNothingLeftAndSaysSo(): void
    {
        $this->account('twice@example.com');
        $laptop = $this->signIn('twice@example.com');
        $this->signIn('twice@example.com');
        $proof = $this->proved($laptop);

        $this->signOutOthers($laptop, $proof);
        $again = $this->signOutOthers($laptop, $proof);

        self::assertSame(200, $this->statusCode());
        self::assertSame(['signedOut' => 0, 'thisDevice' => false], $again);
    }

    #[Test]
    public function theAuditTrailHasOneEventWithTheCount(): void
    {
        $user = $this->account('audited@example.com');
        $laptop = $this->signIn('audited@example.com');
        $this->signIn('audited@example.com');
        $this->signIn('audited@example.com');

        $this->signOutOthers($laptop, $this->proved($laptop));

        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['action' => 'sessions.signed_out_elsewhere']);
        self::assertCount(1, $entries);
        self::assertTrue($user->getId()->equals($entries[0]->getSubjectId()));
        self::assertSame(['signedOut' => [null, 3]], $entries[0]->getChanges());
    }

    /** The configured pool is reset between requests, so the budget is held in the test's own storage (see AssistantTest). */
    #[Test]
    public function pastTheLimitItIsRefusedWithATimeAndRevokesNothing(): void
    {
        $this->client->disableReboot();
        self::getContainer()->set('limiter.sign_out_elsewhere_account', new RateLimiterFactory(
            ['id' => 'sign_out_elsewhere_account', 'policy' => 'fixed_window', 'limit' => 5, 'interval' => '15 minutes'],
            new InMemoryStorage(),
        ));
        $this->account('limited@example.com');
        $laptop = $this->signIn('limited@example.com');
        $proof = $this->proved($laptop);

        for ($call = 1; $call <= 5; ++$call) {
            $this->signOutOthers($laptop, $proof);
            self::assertSame(200, $this->statusCode());
        }

        $phone = $this->signIn('limited@example.com');
        $refused = $this->signOutOthers($laptop, $proof);

        self::assertSame(429, $this->statusCode());
        self::assertSame(ErrorCode::TooManyAttempts->type(), $refused['type']);
        self::assertMatchesRegularExpression('/Try again at \d\d:\d\d\./', Type\string()->coerce($refused['detail'] ?? ''));
        self::assertNotNull($this->client->getResponse()->headers->get('Retry-After'));
        self::assertSame(200, $this->me($phone['accessToken']));
    }

    #[Test]
    public function theConfiguredBudgetIsFiveAWindow(): void
    {
        $limiter = self::serviceById('limiter.sign_out_elsewhere_account', RateLimiterFactory::class)->create('one-account');

        $accepted = 0;
        while ($limiter->consume()->isAccepted() && $accepted < 50) {
            ++$accepted;
        }

        self::assertSame(5, $accepted);
    }

    #[Test]
    public function withTwoFactorOnARecoveryCodeCountsAndIsSpent(): void
    {
        $user = $this->account('second@example.com');
        $factor = new TwoFactorFactor($user, self::service(SecretBox::class)->seal(self::SECRET));
        $factor->activate(new Clock()->now());
        self::em()->persist($factor);
        $codes = self::service(RecoveryCodes::class)->issueFor($user);
        self::em()->flush();
        $laptop = $this->signIn('second@example.com', $codes[0]);
        $phone = $this->signIn('second@example.com', $codes[1]);

        $alone = $this->call('POST', '/api/auth/proof', $laptop['accessToken'], ['password' => self::PASSWORD]);
        self::assertSame(ErrorCode::TwoFactorRequired->type(), $alone['type']);
        self::assertSame(200, $this->me($phone['accessToken']));

        $proved = $this->call('POST', '/api/auth/proof', $laptop['accessToken'], ['password' => self::PASSWORD, 'code' => $codes[2]]);
        $body = $this->signOutOthers($laptop, Type\string()->coerce($proved['proof'] ?? null));

        self::assertSame(false, $body['thisDevice']);
        self::assertSame(401, $this->me($phone['accessToken']));
        self::assertSame(7, self::service(RecoveryCodeRepository::class)->count(['user' => $user, 'usedAt' => null]));
    }

    #[Test]
    public function anAccountWithNoPasswordIsSentToItsProvider(): void
    {
        $user = self::service(UserRegistrar::class)->registerFromProvider('kemi@example.com', 'Kemi')->user;
        self::onboard($user);
        $tokens = self::service(TokenIssuer::class)->issueFor($user);
        self::em()->flush();

        $body = $this->call('POST', '/api/auth/proof', $tokens->accessToken, ['password' => self::PASSWORD]);

        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type']);
        self::assertSame('provider', Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($body['violations'] ?? [])[0]['propertyPath']);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Lost', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    /** @return array{accessToken: string, sessionId: string} */
    private function signIn(string $address, #[SensitiveParameter] ?string $recoveryCode = null): array
    {
        $body = $this->call('POST', '/api/auth/login', null, ['email' => $address, 'password' => self::PASSWORD]);

        if (null !== $recoveryCode) {
            $body = $this->call('POST', '/api/auth/two-factor/verify', null, ['challenge' => $body['twoFactorChallenge'] ?? null, 'recoveryCode' => $recoveryCode]);
        }

        $tokens = Type\shape(['accessToken' => Type\string(), 'sessionId' => Type\string()], true)->coerce($body);

        return ['accessToken' => $tokens['accessToken'], 'sessionId' => $tokens['sessionId']];
    }

    /** @param array{accessToken: string, sessionId: string} $device */
    private function proved(array $device): string
    {
        $body = $this->call('POST', '/api/auth/proof', $device['accessToken'], ['password' => self::PASSWORD]);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['proof']);
    }

    /** @param array{accessToken: string, sessionId: string} $device */
    private function signOutOthers(array $device, #[SensitiveParameter] ?string $proof): array
    {
        return $this->call('POST', '/api/auth/sessions/others', $device['accessToken'], ['proof' => $proof, 'sessionId' => $device['sessionId']]);
    }

    /** @param array<string, mixed>|null $body */
    private function call(string $method, string $path, #[SensitiveParameter] ?string $accessToken, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            ...(null === $accessToken ? [] : ['HTTP_AUTHORIZATION' => 'Bearer ' . $accessToken]),
        ], content: 'GET' === $method ? null : Json\encode($body ?? new stdClass()));

        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($content));
    }

    private function me(#[SensitiveParameter] string $accessToken): int
    {
        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $accessToken]);

        return $this->client->getResponse()->getStatusCode();
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
