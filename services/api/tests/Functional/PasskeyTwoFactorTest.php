<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Mail\UserMailer;
use App\Domain\User\Model\SecondFactorAnswer;
use App\Domain\User\TwoFactor\Passkey\Passkeys;
use App\Domain\User\TwoFactor\SecondFactorCheck;
use App\Domain\User\TwoFactor\SecondFactors;
use App\Domain\User\UserRegistrar;
use App\Entity\Passkey;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasskeyStep;
use App\Http\Exception\ApiException;
use App\Repository\PasskeyRepository;
use App\Repository\TwoFactorFactorRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\VirtualAuthenticator;
use App\Tests\Traits\OnboardsAccounts;
use App\WebAuthn\RelyingParty;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use Psl\Encoding\Base64;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;

final class PasskeyTwoFactorTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADDRESS = 'ines@example.com';

    private User $user;
    private VirtualAuthenticator $phone;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime('2026-11-23 12:00:10');
        $this->user = self::service(UserRegistrar::class)->register(self::ADDRESS, 'Inês', self::PASSWORD)->user;
        self::onboard($this->user);
        $this->phone = new VirtualAuthenticator();
    }

    #[Test]
    public function aPasskeyTurnsTwoFactorOnWithRecoveryCodesAndItsOwnWords(): void
    {
        $this->authenticated();
        $first = $this->call('GET', '/api/auth/two-factor');
        self::assertTrue($first['passkeysOffered'] ?? null, Json\encode($first));

        $codes = $this->turnOnWith($this->phone);

        self::assertCount(10, $codes);
        $status = $this->call('GET', '/api/auth/two-factor');
        self::assertTrue($status['on']);
        self::assertSame(10, $status['recoveryCodesLeft']);
        self::assertSame([[
            'kind' => 'passkey',
            'id' => Type\string()->coerce(Type\dict(Type\string(), Type\mixed())->coerce(Type\vec(Type\mixed())->coerce($status['factors'])[0])['id']),
            'provider' => 'Apple Passwords',
            'synced' => true,
            'addedAt' => '2026-11-23T12:00:10+00:00',
        ]], $status['factors']);

        $on = $this->emailsTitled('twoFactor.on.subject');
        self::assertCount(1, $on);
        self::assertStringContainsString('asks for your passkey as well', (string) $on[0]->getTextBody());
        self::assertStringContainsString('Lost your passkeys and your recovery codes?', (string) $on[0]->getTextBody());
    }

    #[Test]
    public function aPasskeyAnswersTheSignInStepInPlaceOfACode(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);

        [$status, $body] = $this->login();
        self::assertSame(202, $status);
        self::assertSame(['app' => false, 'passkeys' => true], $body['factors']);

        $challenge = Type\string()->coerce($body['twoFactorChallenge']);
        $options = $this->call('POST', '/api/auth/two-factor/passkey-options', ['challenge' => $challenge]);
        self::assertSame('soirely.test', $options['rpId']);
        self::assertSame('required', $options['userVerification']);
        self::assertSame(300_000, $options['timeout']);
        self::assertCount(1, Type\vec(Type\mixed())->coerce($options['allowCredentials']));

        $signedIn = $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'passkey' => $this->phone->get(VirtualAuthenticator::challengeOf($options))]);

        self::assertSame(200, $this->statusCode(), Json\encode($signedIn));
        self::assertIsString($signedIn['accessToken'] ?? null);
    }

    #[Test]
    public function anEnvironmentWithNoRelyingPartyAsksForNoPasskeyThoughTheMemberHoldsOne(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);
        $here = static fn (RelyingParty $party): SecondFactors => new SecondFactors(
            self::service(TwoFactorFactorRepository::class),
            self::service(PasskeyRepository::class),
            $party,
        );

        self::assertSame(['app' => false, 'passkeys' => false], $here(new RelyingParty('127.0.0.1', 'http://127.0.0.1:5173'))->askable($this->fresh()));
        self::assertSame(['app' => false, 'passkeys' => true], $here(new RelyingParty('127.0.0.1', 'http://127.0.0.1:5173'))->kinds($this->fresh()), 'the words still name the passkey held');
        self::assertSame(['app' => false, 'passkeys' => true], $here(new RelyingParty('soirely.test', 'https://app.soirely.test'))->askable($this->fresh()));
    }

    #[Test]
    public function aRefusedPasskeyIsAWrongCodeOnTheSharedBudget(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);
        $stranger = new VirtualAuthenticator();
        $check = self::service(SecondFactorCheck::class);
        $strangers = fn () => new SecondFactorAnswer(passkey: $stranger->get(VirtualAuthenticator::challengeOf(
            self::service(Passkeys::class)->requestOptions($this->fresh(), PasskeyStep::SignIn),
        )));

        foreach (Vec\range(1, 4) as $_) {
            self::assertSame(ErrorCode::PasskeyRefused, $this->refusal(fn () => $check->pass($this->fresh(), $strangers(), PasskeyStep::SignIn))->errorCode);
        }

        self::assertSame(ErrorCode::TooManyAttempts, $this->refusal(fn () => $check->pass($this->fresh(), $strangers(), PasskeyStep::SignIn))->errorCode);
        self::assertSame(ErrorCode::TooManyAttempts, $this->refusal(fn () => $check->pass($this->fresh(), new SecondFactorAnswer(either: '123456'), PasskeyStep::SignIn))->errorCode, 'a code waits out the same pause');
    }

    #[Test]
    public function aChallengeIsUsedOnceAndOnlyAtTheStepThatAskedForIt(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);
        $forTurningOff = VirtualAuthenticator::challengeOf($this->call('POST', '/api/auth/two-factor/passkeys/options', ['step' => 'turn_off']));
        $challenge = $this->challenge();

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'passkey' => $this->phone->get($forTurningOff)]);
        self::assertSame(ErrorCode::PasskeyRefused->type(), $this->last()['type'], 'a challenge made for turning off');

        $once = $this->signInChallenge($challenge);
        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'passkey' => $this->phone->get($once)]);
        self::assertSame(200, $this->statusCode());

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'passkey' => $this->phone->get($once)]);
        self::assertSame(ErrorCode::PasskeyRefused->type(), $this->last()['type'], 'the same challenge again');
    }

    #[Test]
    public function addingAPasskeyTakesTheCurrentFactorAndStopsAtTen(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);

        $this->call('POST', '/api/auth/two-factor/passkeys/options', ['make' => true]);
        self::assertSame(ErrorCode::BadRequest->type(), $this->last()['type'], 'no current factor');

        foreach (Vec\range(2, 10) as $_) {
            $this->addWith(new VirtualAuthenticator());
        }

        self::assertSame(10, self::service(PasskeyRepository::class)->countFor($this->fresh()));
        self::assertCount(9, $this->emailsTitled('twoFactor.added.subject'));

        $this->call('POST', '/api/auth/two-factor/passkeys/options', ['make' => true, 'passkey' => $this->phone->get($this->stepChallenge('add'))]);
        self::assertSame(ErrorCode::PasskeyLimit->type(), $this->last()['type']);
    }

    #[Test]
    public function theEleventhPasskeyIsRefusedWhenItIsRegisteredAndItsChallengeIsSpent(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);

        foreach (Vec\range(2, 9) as $_) {
            $this->addWith(new VirtualAuthenticator());
        }

        [$tenth, $eleventh] = Vec\map([1, 2], fn (): string => VirtualAuthenticator::challengeOf(
            $this->call('POST', '/api/auth/two-factor/passkeys/options', ['make' => true, 'passkey' => $this->phone->get($this->stepChallenge('add'))]),
        ));
        $this->call('POST', '/api/auth/two-factor/passkeys', ['passkey' => new VirtualAuthenticator()->create($tenth)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $late = new VirtualAuthenticator()->create($eleventh);
        $this->call('POST', '/api/auth/two-factor/passkeys', ['passkey' => $late]);
        self::assertSame(ErrorCode::PasskeyLimit->type(), $this->last()['type']);
        self::assertSame(10, self::service(PasskeyRepository::class)->countFor($this->fresh()));

        $this->call('POST', '/api/auth/two-factor/passkeys', ['passkey' => $late]);
        self::assertSame(ErrorCode::PasskeyRefused->type(), $this->last()['type'], 'the refused registration spent its challenge');
    }

    #[Test]
    public function aRemovedPasskeyIsRefusedAndAUsedOneSaysWhetherItIsSynced(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);
        $key = new VirtualAuthenticator();
        $this->addWith($key);
        $keys = Type\instance_of(Passkey::class)->coerce(self::service(PasskeyRepository::class)->findOneOf($this->fresh(), Base64\encode($key->credentialId, Base64\Variant::UrlSafe, padding: false)));

        $this->call('POST', '/api/auth/two-factor/remove', ['factor' => $keys->getId()->toRfc4122(), 'passkey' => $this->phone->get($this->stepChallenge('remove'))]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        $challenge = $this->challenge();
        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'passkey' => $key->get($this->signInChallenge($challenge))]);
        self::assertSame(ErrorCode::PasskeyRefused->type(), $this->last()['type'], 'the removed passkey');

        $this->phone->backedUp = false;
        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'passkey' => $this->phone->get($this->signInChallenge($challenge))]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->authenticated();
        self::assertFalse(Type\dict(Type\string(), Type\mixed())->coerce(Type\vec(Type\mixed())->coerce($this->call('GET', '/api/auth/two-factor')['factors'])[0])['synced']);
    }

    #[Test]
    public function theLastFactorIsRemovedOnlyByTurningTwoFactorOff(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);
        $key = new VirtualAuthenticator();
        $this->addWith($key);
        [$first, $second] = Vec\map(self::service(PasskeyRepository::class)->findFor($this->fresh()), static fn ($p): string => $p->getId()->toRfc4122());

        $this->call('POST', '/api/auth/two-factor/remove', ['factor' => $first, 'passkey' => $this->phone->get($this->stepChallenge('remove'))]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertCount(1, $this->emailsTitled('twoFactor.removed.subject'));

        $this->call('POST', '/api/auth/two-factor/remove', ['factor' => $second, 'passkey' => $this->phone->get($this->stepChallenge('remove'))]);
        self::assertSame(ErrorCode::TwoFactorLastFactor->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/two-factor/disable', ['passkey' => $this->phone->get($this->stepChallenge('turn_off'))]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(0, self::service(PasskeyRepository::class)->countFor($this->fresh()));
        self::assertFalse($this->call('GET', '/api/auth/two-factor')['on']);
    }

    #[Test]
    public function theAppJoinsPasskeysWithoutNewCodesOrSayingItTurnedOn(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);

        $this->call('POST', '/api/auth/two-factor/enrol');
        self::assertSame(ErrorCode::BadRequest->type(), $this->last()['type'], 'the current factor first');

        self::mockTime('+1 minute');
        $secret = Type\string()->coerce($this->call('POST', '/api/auth/two-factor/enrol', ['passkey' => $this->phone->get($this->stepChallenge('add_app'))])['secret']);
        $added = $this->call('POST', '/api/auth/two-factor/activate', ['code' => $this->codeNow($secret)]);

        self::assertSame([], $added['recoveryCodes']);
        self::assertCount(1, $this->emailsTitled('twoFactor.on.subject'));
        self::assertCount(1, $this->emailsTitled('twoFactor.added.subject'));
        self::assertSame(['app', 'passkey'], Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->call('GET', '/api/auth/two-factor')['factors']), static fn (array $f): mixed => $f['kind']));
    }

    #[Test]
    public function confirmItsYouAndAResetLinkTakeAPasskey(): void
    {
        $this->authenticated();
        $this->turnOnWith($this->phone);

        $this->call('POST', '/api/auth/proof', ['password' => self::PASSWORD]);
        $pending = Type\string()->coerce($this->last()['pendingProof']);
        $proved = $this->call('POST', '/api/auth/proof', ['pendingProof' => $pending, 'passkey' => $this->phone->get($this->stepChallenge('proof'))]);
        self::assertIsString($proved['proof'] ?? null, Json\encode($proved));

        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->call('POST', '/api/auth/password/forgot', ['email' => self::ADDRESS]);
        $link = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        $token = Regex\first_match((string) $link->getTextBody(), '/reset-password\?token=([0-9a-f]+)/')[1] ?? '';

        $check = $this->call('POST', '/api/auth/password/reset/check', ['token' => $token]);
        self::assertSame(['app' => false, 'passkeys' => true], $check['factors']);

        $options = $this->call('POST', '/api/auth/password/reset/passkey-options', ['token' => $token]);
        $this->call('POST', '/api/auth/password/reset/code', ['token' => $token, 'passkey' => $this->phone->get(VirtualAuthenticator::challengeOf($options))]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return list<string> */
    private function turnOnWith(VirtualAuthenticator $authenticator): array
    {
        $options = $this->call('POST', '/api/auth/two-factor/passkeys/options', ['make' => true]);
        self::assertSame('required', Type\dict(Type\string(), Type\mixed())->coerce($options['authenticatorSelection'])['residentKey']);
        self::assertSame('none', $options['attestation']);

        $made = $this->call('POST', '/api/auth/two-factor/passkeys', ['passkey' => $authenticator->create(VirtualAuthenticator::challengeOf($options))]);
        self::assertSame(200, $this->statusCode(), Json\encode($made));

        return Type\vec(Type\string())->coerce($made['recoveryCodes']);
    }

    private function addWith(VirtualAuthenticator $authenticator): void
    {
        $options = $this->call('POST', '/api/auth/two-factor/passkeys/options', ['make' => true, 'passkey' => $this->phone->get($this->stepChallenge('add'))]);
        self::assertSame(200, $this->statusCode(), Json\encode($options));
        $made = $this->call('POST', '/api/auth/two-factor/passkeys', ['passkey' => $authenticator->create(VirtualAuthenticator::challengeOf($options))]);
        self::assertSame([], $made['recoveryCodes'] ?? null, Json\encode($made));
    }

    private function stepChallenge(string $step): string
    {
        return VirtualAuthenticator::challengeOf($this->call('POST', '/api/auth/two-factor/passkeys/options', ['step' => $step]));
    }

    private function signInChallenge(string $challenge): string
    {
        return VirtualAuthenticator::challengeOf($this->call('POST', '/api/auth/two-factor/passkey-options', ['challenge' => $challenge]));
    }

    private function challenge(): string
    {
        [$status, $body] = $this->login();
        self::assertSame(202, $status);

        return Type\string()->coerce($body['twoFactorChallenge']);
    }

    /** @return array{0: int, 1: array<string, mixed>} */
    private function login(): array
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $body = $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::PASSWORD]);

        return [$this->statusCode(), $body];
    }

    /** @return list<Email> */
    private function emailsTitled(string $subjectKey): array
    {
        $subject = self::service(UserMailer::class)->line($subjectKey, 'en');

        return Vec\filter(
            Vec\map(self::getMailerMessages(), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message)),
            static fn (Email $email): bool => $subject === $email->getSubject(),
        );
    }

    private function codeNow(#[SensitiveParameter] string $secret): string
    {
        return TOTP::createFromSecret(Type\non_empty_string()->coerce($secret))->at(Type\uint()->coerce(new Clock()->now()->getTimestamp()));
    }

    private function refusal(callable $attempt): ApiException
    {
        try {
            $attempt();
        } catch (ApiException $e) {
            return $e;
        }

        self::fail('the second factor was accepted');
    }

    private function fresh(): User
    {
        return Type\instance_of(User::class)->coerce(self::service(EntityManagerInterface::class)->find(User::class, $this->user->getId()));
    }

    private function authenticated(): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh()));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: 'GET' === $method ? '' : Json\encode($body ?? new stdClass()));

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
