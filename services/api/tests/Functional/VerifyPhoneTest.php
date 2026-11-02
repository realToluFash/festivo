<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Domain\User\Verification\RecordingTextMessageSender;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Repository\PhoneNumberRepository;
use App\Tests\ApiTestCase;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class VerifyPhoneTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->user = $this->account('phone@example.com');
        $this->signIn($this->user);
    }

    #[Test]
    public function aNumberIsTextedACodeAndTheCodeVerifiesIt(): void
    {
        $body = $this->set('NG', '0803 555 0142');

        self::assertSame(200, $this->statusCode());
        self::assertTrue($body['verificationNeeded']);
        self::assertSame(VerificationChallenge::RESEND_COOLDOWN_SECONDS, $body['cooldownSeconds']);
        self::assertCount(1, $this->texts());
        self::assertSame('+2348035550142', $this->texts()[0]['to']);

        $verified = $this->call('POST', '/api/auth/verify/phone', ['code' => $this->codeTo('+2348035550142')]);

        self::assertSame(200, $this->statusCode());
        self::assertTrue($verified['verified']);

        $me = $this->call('GET', '/api/auth/me');
        $phones = Type\vec(Type\shape([
            'number' => Type\string(),
            'countryCode' => Type\nullable(Type\string()),
            'verified' => Type\bool(),
        ], true))->coerce($me['phoneNumbers']);

        self::assertCount(1, $phones);
        self::assertSame('+2348035550142', $phones[0]['number']);
        self::assertSame('NG', $phones[0]['countryCode']);
        self::assertTrue($phones[0]['verified']);
    }

    /** @return iterable<string, array{string}> */
    public static function oneNumberTypedThreeWays(): iterable
    {
        yield 'national' => ['0803 555 0142'];
        yield 'international with dashes' => ['+234 803-555-0142'];
        yield 'without the trunk zero' => ['8035550142'];
    }

    #[Test]
    #[DataProvider('oneNumberTypedThreeWays')]
    public function aNumberTypedAnyWayIsStoredOnceInE164(string $typed): void
    {
        $this->set('NG', $typed);
        self::service(EntityManagerInterface::class)->clear();

        $stored = self::service(PhoneNumberRepository::class)->findOneByNumber('+2348035550142');
        self::assertNotNull($stored, 'stored in E.164');
        self::assertSame('NG', $stored->getCountryCode());
    }

    #[Test]
    public function theSameNumberSavedAgainChangesNothingAndSendsNothing(): void
    {
        $this->set('NG', '0803 555 0142');
        $first = $this->user->getPrimaryPhoneNumber();

        $body = $this->set('NG', '+234 803 555 0142');

        self::assertFalse($body['verificationNeeded'] && 0 !== $body['cooldownSeconds'], 'nothing new was texted');
        self::assertCount(1, $this->texts());
        self::assertSame($first, $this->user->getPrimaryPhoneNumber());
    }

    /** A contact point is replaced only once its replacement is proved (sc-62, Decided 16 Oct). */
    #[Test]
    public function aChangedNumberWaitsBesideTheCurrentOneUntilItIsVerified(): void
    {
        $this->set('NG', '0803 555 0142');
        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->codeTo('+2348035550142')]);

        $body = $this->set('GH', '024 412 3456');

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertTrue($body['verificationNeeded']);
        self::assertSame('+233244123456', $this->texts()[1]['to']);
        self::assertSame(['+2348035550142' => 'primary, verified', '+233244123456' => 'pending'], $this->phones());
        self::assertTrue($this->call('GET', '/api/auth/me')['verified'], 'the current number still counts');

        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->codeTo('+233244123456')]);

        self::assertSame(200, $this->statusCode());
        self::assertSame(['+233244123456' => 'primary, verified'], $this->phones(), 'the old number goes once the new one is proved');
    }

    #[Test]
    public function aRefusedChangeLeavesTheCurrentNumberAsItWas(): void
    {
        $this->set('NG', '0803 555 0142');
        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->codeTo('+2348035550142')]);
        $theirs = new PhoneNumber($this->account('owner@example.com'), '+233244123456', true, 'GH');
        $theirs->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();

        $this->set('GH', '024 412 3456');

        self::assertSame(409, $this->statusCode());
        self::assertSame(['+2348035550142' => 'primary, verified'], $this->phones());
    }

    #[Test]
    public function aSecondChangeReplacesTheFirstAndGoingBackDropsIt(): void
    {
        $this->set('NG', '0803 555 0142');
        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->codeTo('+2348035550142')]);

        $this->set('GH', '024 412 3456');
        $this->set('KE', '0712 345678');
        self::assertSame(['+2348035550142' => 'primary, verified', '+254712345678' => 'pending'], $this->phones());

        $this->set('NG', '0803 555 0142');
        self::assertSame(['+2348035550142' => 'primary, verified'], $this->phones());
        self::assertCount(3, $this->texts(), 'going back to the current number sends nothing');
    }

    #[Test]
    public function aNumberAlreadyVerifiedOnAnotherAccountIsRefused(): void
    {
        $other = $this->account('other@example.com');
        $theirs = new PhoneNumber($other, '+2348035550142', true, 'NG');
        $theirs->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();

        $this->set('NG', '0803 555 0142');

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::PhoneTaken->type(), $this->last()['type']);
        self::assertSame([], $this->texts());
        self::assertSame($other, self::service(PhoneNumberRepository::class)->findOneByNumber('+2348035550142')?->getUser());
    }

    /** Nobody proved it there, so whoever owns the number can still claim it. */
    #[Test]
    public function aNumberSomebodyElseNeverVerifiedIsReleased(): void
    {
        $other = $this->account('typo@example.com');
        new PhoneNumber($other, '+2348035550142', true, 'NG');
        self::service(EntityManagerInterface::class)->flush();

        $this->set('NG', '0803 555 0142');

        self::assertSame(200, $this->statusCode());
        self::assertSame($this->user, self::service(PhoneNumberRepository::class)->findOneByNumber('+2348035550142')?->getUser());
    }

    #[Test]
    public function anAlternativeThatBecomesPrimaryKeepsItsVerification(): void
    {
        $alternative = new PhoneNumber($this->user, '+2348035550142', false, 'NG');
        $alternative->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();

        $body = $this->set('NG', '0803 555 0142');

        self::assertFalse($body['verificationNeeded']);
        self::assertSame($alternative, $this->user->getPrimaryPhoneNumber());
        self::assertTrue($alternative->isVerified());
        self::assertSame([], $this->texts(), 'a verified number is not texted');
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function badNumbers(): iterable
    {
        yield 'blank' => ['NG', '  ', 'Enter your mobile number.'];
        yield 'too short' => ['NG', '803 55', 'That number looks too short for Nigeria. Check it and try again.'];
        yield 'too long' => ['NG', '0803 555 0142 9999 9999', 'That number looks too long for Nigeria. Check it and try again.'];
    }

    #[Test]
    #[DataProvider('badNumbers')]
    public function aNumberThatIsNotOneIsRefusedNamingTheCountry(string $country, string $typed, string $message): void
    {
        $this->set($country, $typed);

        self::assertSame(422, $this->statusCode());
        $violations = Type\vec(Type\dict(Type\string(), Type\string()))->coerce($this->last()['violations']);
        self::assertSame('number', $violations[0]['propertyPath']);
        self::assertSame($message, $violations[0]['message']);
        self::assertSame(0, self::service(PhoneNumberRepository::class)->count([]), 'nothing was saved');
    }

    /** The same rules as email, not a second copy: one wrong-code path, one limit, one cooldown. */
    #[Test]
    public function wrongCodesTheLimitAndTheCooldownAreEmailsRules(): void
    {
        $this->set('NG', '0803 555 0142');

        $this->call('POST', '/api/auth/verify/phone', ['code' => '000000']);
        self::assertSame(ErrorCode::VerificationCodeInvalid->type(), $this->last()['type']);

        for ($attempt = 1; $attempt < VerificationChallenge::MAXIMUM_ATTEMPTS; ++$attempt) {
            $this->call('POST', '/api/auth/verify/phone', ['code' => '000000']);
        }
        self::assertSame(ErrorCode::VerificationCodeExhausted->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/verify/phone/resend');
        self::assertSame(429, $this->statusCode(), 'the text that was just sent started the cooldown');

        $cooldown = $this->call('GET', '/api/auth/verify/phone/resend');
        self::assertGreaterThan(0, $cooldown['cooldownSeconds']);
    }

    #[Test]
    public function aCodeSentAsANumberIsAFieldErrorInTheTextsWords(): void
    {
        $this->set('NG', '0803 555 0142');

        $body = $this->call('POST', '/api/auth/verify/phone', ['code' => 123456]);

        self::assertSame(422, $this->statusCode());
        self::assertSame([['propertyPath' => 'code', 'message' => 'Enter the 6-digit code from the text.', 'code' => 'validation_failed']], $body['violations']);
    }

    #[Test]
    public function anExpiredCodeSaysSo(): void
    {
        $this->set('NG', '0803 555 0142');
        $code = $this->codeTo('+2348035550142');

        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(
            "UPDATE verification_challenges SET expires_at = NOW() - interval '1 minute' WHERE phone_number_id IS NOT NULL",
        );
        self::service(EntityManagerInterface::class)->clear();

        $this->call('POST', '/api/auth/verify/phone', ['code' => $code]);

        self::assertSame(ErrorCode::VerificationCodeExpired->type(), $this->last()['type']);
    }

    /** What Verify phone reads as it opens (sc-826): the code's state, without spending a try or sending a text. */
    #[Test]
    public function theOpeningReadSaysWhetherTheCodeIsLiveExhaustedOrExpired(): void
    {
        $this->set('NG', '0803 555 0142');
        $code = $this->codeTo('+2348035550142');
        $sent = Iter\count($this->texts());
        self::assertSame('live', $this->call('GET', '/api/auth/verify/phone/resend')['codeState']);

        for ($attempt = 0; $attempt < VerificationChallenge::MAXIMUM_ATTEMPTS; ++$attempt) {
            $this->call('POST', '/api/auth/verify/phone', ['code' => '000000']);
        }

        self::assertSame('exhausted', $this->call('GET', '/api/auth/verify/phone/resend')['codeState']);
        $this->call('POST', '/api/auth/verify/phone', ['code' => $code]);
        self::assertSame(ErrorCode::VerificationCodeExhausted->type(), $this->last()['type'], 'reading it spent no try, and the try agrees');

        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(
            "UPDATE verification_challenges SET expires_at = NOW() - interval '1 minute' WHERE phone_number_id IS NOT NULL",
        );
        self::service(EntityManagerInterface::class)->clear();

        self::assertSame('expired', $this->call('GET', '/api/auth/verify/phone/resend')['codeState'], 'expiry is checked first, as a try checks it');
        self::assertCount($sent, $this->texts(), 'reading it sent no text');
    }

    #[Test]
    public function theTextIsInTheAccountsLanguage(): void
    {
        $this->user->setLocale('fr');
        self::service(EntityManagerInterface::class)->flush();

        $this->set('NG', '0803 555 0142');

        self::assertStringStartsWith('Votre code Soirely est ', $this->texts()[0]['body']);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    private function signIn(User $user): void
    {
        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );
    }

    /** @return array<string, mixed> */
    private function set(string $country, string $number): array
    {
        return $this->call('PUT', '/api/auth/phone', ['countryCode' => $country, 'number' => $number]);
    }

    /** @return array<string, string> each number the account holds, and what it is */
    private function phones(): array
    {
        self::service(EntityManagerInterface::class)->clear();
        $rows = self::service(PhoneNumberRepository::class)->findBy(['user' => $this->user->getId()], ['isPending' => 'ASC', 'number' => 'ASC']);
        $described = [];

        foreach ($rows as $row) {
            $described[$row->getNumber()] = $row->isPending()
                ? 'pending'
                : Str\format('%s, %s', $row->isPrimary() ? 'primary' : 'alternative', $row->isVerified() ? 'verified' : 'unverified');
        }

        return $described;
    }

    /** @return list<array{to: string, body: string}> */
    private function texts(): array
    {
        return self::service(RecordingTextMessageSender::class)->sent;
    }

    private function codeTo(string $number): string
    {
        foreach (Vec\reverse($this->texts()) as $text) {
            if ($text['to'] === $number) {
                return Regex\first_match($text['body'], '/(\d{6})/')[1] ?? '';
            }
        }

        self::fail(Str\format('nothing was texted to %s', $number));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));

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
