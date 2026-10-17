<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Domain\User\Verification\PhoneCodeChannels;
use App\Domain\User\Verification\RecordingTextMessageSender;
use App\Domain\User\Verification\RecordingWhatsAppSender;
use App\Entity\PhoneCodeDelivery;
use App\Entity\PhoneNumber;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Tests\ApiTestCase;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Psl\Vec;

/** sc-750: WhatsApp first where the country puts it first, the same code by SMS behind it. */
final class PhoneCodeWhatsAppTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string LAGOS = '+2348035550142';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $user = self::service(UserRegistrar::class)->register('phone@example.com', 'Person', self::PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    #[Test]
    public function aNigerianNumberGetsItsCodeOnWhatsAppAndItVerifies(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        self::assertSame([], $this->texts(), 'no text while WhatsApp may deliver');
        self::assertSame('whatsapp', $this->opening()['route']);
        self::assertSame('en', $this->whatsApp()->sent[0]['locale']);

        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->whatsAppCode()]);
        self::assertTrue(Type\shape(['verified' => Type\bool()], true)->coerce($this->last())['verified']);
    }

    #[Test]
    public function aNumberWhatsAppRefusesIsTextedTheSameCodeAtOnce(): void
    {
        $this->order(smsOnly: 'US');
        $this->whatsApp()->refused[] = self::LAGOS;

        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        self::assertCount(1, $this->texts());
        self::assertSame('sms_fallback', $this->opening()['route']);
        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->textedCode()]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    /** Meta reports the message failed: the same code goes by text, with no new expiry and no resend. */
    #[Test]
    public function aFailureReportTextsTheSameCode(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);
        $expiresAt = $this->challenge()->getExpiresAt();

        $this->report('failed', signedWith: 'the wrong secret');
        self::assertSame(403, $this->client->getResponse()->getStatusCode());
        self::assertSame([], $this->texts(), 'an unsigned report changes nothing');

        $this->report('failed');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame($this->whatsAppCode(), $this->textedCode());
        self::assertEquals($expiresAt, $this->challenge()->getExpiresAt());
        self::assertSame('sms_fallback', $this->opening()['route']);
        self::assertGreaterThan(0, $this->opening()['cooldownSeconds'], 'the fallback did not count as a resend');
    }

    #[Test]
    public function aDeliveredCodeIsNeverTexted(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        $this->report('delivered');
        $this->sentAgo(31);

        self::assertSame('whatsapp', $this->opening()['route']);
        self::assertSame([], $this->texts());

        // Delivered to a WhatsApp account is not delivered to the person: they may still ask for a text.
        $this->call('POST', '/api/auth/verify/phone/text-instead');
        self::assertSame(['route' => 'sms_chosen'], $this->last());
        self::assertSame($this->whatsAppCode(), $this->textedCode());
    }

    /** A code that can no longer be used is never texted: no paid SMS for a dead code. */
    #[Test]
    public function anExpiredOrExhaustedCodeIsNeverTexted(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        for ($attempt = 0; $attempt < VerificationChallenge::MAXIMUM_ATTEMPTS; ++$attempt) {
            $this->call('POST', '/api/auth/verify/phone', ['code' => '000000']);
        }
        $this->sentAgo(31);
        $this->opening();
        $this->report('failed');
        $this->call('POST', '/api/auth/verify/phone/text-instead');
        self::assertSame([], $this->texts(), 'exhausted');
        self::assertNull($this->challenge()->getSealedCode(), 'and no longer kept');

        $this->sentAgo(61);
        $this->call('POST', '/api/auth/verify/phone/resend');
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement("UPDATE verification_challenges SET expires_at = NOW() - interval '1 minute', created_at = NOW() - interval '20 minutes' WHERE revoked_at IS NULL");
        self::em()->clear();

        self::assertSame('expired', $this->opening()['codeState']);
        self::assertSame([], $this->texts(), 'expired');
    }

    /** A late report about an old code acts on that code, never on the one sent since. */
    #[Test]
    public function aLateFailureForAReplacedCodeLeavesTheNewOneAlone(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);
        $first = Iter\last($this->whatsApp()->sent)['id'] ?? '';
        $this->sentAgo(61);
        $this->call('POST', '/api/auth/verify/phone/resend');

        $this->report('failed', messageId: $first);

        self::assertSame([], $this->texts());
        self::assertSame('whatsapp', $this->opening()['route']);
    }

    /** The code is kept only while it is live on WhatsApp: used, it is gone. */
    #[Test]
    public function aUsedCodeIsNoLongerKept(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->whatsAppCode()]);

        self::assertNull($this->challenge()->getSealedCode());
    }

    /** Nothing heard from WhatsApp for 30 seconds: the screen's read texts the same code. */
    #[Test]
    public function thirtySilentSecondsTextTheSameCode(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        $this->sentAgo(20);
        self::assertSame('whatsapp', $this->opening()['route'], 'not yet');

        $this->sentAgo(31);
        self::assertSame('sms_fallback', $this->opening()['route']);
        self::assertSame($this->whatsAppCode(), $this->textedCode());
        self::assertSame('sms_fallback', $this->opening()['route'], 'texted once, however often it is read');
        self::assertCount(1, $this->texts());
    }

    #[Test]
    public function textItToMeInsteadSendsTheSameCodeOnceAndLaterCodesByText(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        $this->call('POST', '/api/auth/verify/phone/text-instead');
        self::assertSame(['route' => 'sms_chosen'], $this->last());
        self::assertSame($this->whatsAppCode(), $this->textedCode());

        $this->call('POST', '/api/auth/verify/phone/text-instead');
        self::assertSame(ErrorCode::Conflict->type(), $this->last()['type'], 'once');

        $this->sentAgo(61);
        $this->call('POST', '/api/auth/verify/phone/resend');
        self::assertCount(1, $this->whatsApp()->sent, 'a new code stays on text for the rest of the attempt');
        self::assertCount(2, $this->texts());
        self::assertSame('sms_preferred', $this->opening()['route'], 'a new code, so not "the same code"');

        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->textedCode()]);
        self::assertFalse($this->phone()->wantsCodesByText(), 'the attempt is over once the number is verified');
    }

    #[Test]
    public function anSmsOnlyCountryNeverTriesWhatsApp(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'US', 'number' => '(201) 555-0123']);

        self::assertSame([], $this->whatsApp()->sent);
        self::assertCount(1, $this->texts());
        self::assertSame('sms_only', $this->opening()['route']);
    }

    #[Test]
    public function aCountrysOrderIsConfiguration(): void
    {
        $this->order(smsOnly: 'US,NG');

        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        self::assertSame([], $this->whatsApp()->sent);
        self::assertSame('sms_only', $this->opening()['route']);
    }

    /** One code, one expiry, one attempt limit, whatever the channel. */
    #[Test]
    public function theAttemptLimitIsSharedAcrossChannels(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);

        $this->report('failed');
        $texted = $this->textedCode();

        for ($attempt = 0; $attempt < VerificationChallenge::MAXIMUM_ATTEMPTS; ++$attempt) {
            $this->call('POST', '/api/auth/verify/phone', ['code' => '000000']);
        }

        $this->call('POST', '/api/auth/verify/phone', ['code' => $texted]);
        self::assertSame(ErrorCode::VerificationCodeExhausted->type(), $this->last()['type'], 'the texted code shares the five tries');
    }

    /** Each code's route is kept per country, with no content, for the monthly fallback rate. */
    #[Test]
    public function everyRouteIsRecordedByCountry(): void
    {
        $this->order(smsOnly: 'US');
        $this->call('PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '0803 555 0142']);
        $this->report('failed');

        $rows = self::em()->getRepository(PhoneCodeDelivery::class)->findAll();

        self::assertSame([['NG', 'whatsapp'], ['NG', 'sms_fallback']], Vec\map($rows, static fn (PhoneCodeDelivery $row): array => [$row->getCountryCode(), $row->getRoute()->value]));
    }

    #[Test]
    public function metaSubscribesWithOurVerifyTokenOnly(): void
    {
        $this->client->request('GET', '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=development-verify-token&hub.challenge=1158201444');
        self::assertSame('1158201444', $this->client->getResponse()->getContent());

        $this->client->request('GET', '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=guessed&hub.challenge=1');
        self::assertSame(403, $this->client->getResponse()->getStatusCode());
    }

    private function order(string $smsOnly): void
    {
        self::getContainer()->set(PhoneCodeChannels::class, new PhoneCodeChannels(true, $smsOnly));
    }

    private function whatsApp(): RecordingWhatsAppSender
    {
        return self::service(RecordingWhatsAppSender::class);
    }

    /** @return list<array{to: string, body: string}> */
    private function texts(): array
    {
        return self::service(RecordingTextMessageSender::class)->sent;
    }

    private function whatsAppCode(): string
    {
        return Iter\last($this->whatsApp()->sent)['code'] ?? self::fail('nothing was sent on WhatsApp');
    }

    private function textedCode(): string
    {
        return Regex\first_match(Iter\last($this->texts())['body'] ?? '', '/(\d{6})/')[1] ?? self::fail('nothing was texted');
    }

    private function challenge(): VerificationChallenge
    {
        self::em()->clear();

        return Type\instance_of(VerificationChallenge::class)->coerce(self::em()->getRepository(VerificationChallenge::class)->findOneBy([], ['id' => 'DESC']));
    }

    private function phone(): PhoneNumber
    {
        self::em()->clear();

        return Type\instance_of(PhoneNumber::class)->coerce(self::em()->getRepository(PhoneNumber::class)->findOneBy([]));
    }

    private function sentAgo(int $seconds): void
    {
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(
            'UPDATE verification_challenges SET created_at = :at',
            ['at' => new DateTimeImmutable('-' . $seconds . ' seconds')->format('Y-m-d H:i:s')],
        );
        self::em()->clear();
    }

    private function report(string $status, string $signedWith = 'development-app-secret', ?string $messageId = null): void
    {
        $body = Json\encode(['entry' => [['changes' => [['value' => ['statuses' => [['id' => $messageId ?? Iter\last($this->whatsApp()->sent)['id'] ?? '', 'status' => $status]]]]]]]]);

        $this->client->request('POST', '/api/webhooks/whatsapp', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_HUB_SIGNATURE_256' => 'sha256=' . \hash_hmac('sha256', $body, $signedWith),
        ], content: $body);
    }

    /** @return array<string, mixed> */
    private function opening(): array
    {
        return $this->call('GET', '/api/auth/verify/phone/resend');
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
}
