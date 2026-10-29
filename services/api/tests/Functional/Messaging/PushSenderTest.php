<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Channel\PushSender;
use App\Domain\Messaging\Command\WorkNotificationsCommand;
use App\Domain\Messaging\Exception\Unreachable;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Messaging\PushTargets;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\PushTargetKind;
use App\Integrations\Expo\ExpoPushService;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use RuntimeException;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\Uid\Uuid;

/** The Expo half against Expo's documented answers; the EAS project that would let a real phone receive one does not exist yet. */
final class PushSenderTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @mago-expect lint:no-literal-password a made-up token */
    private const string TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

    private User $member;

    /** @var list<array{url: string, options: array<array-key, mixed>}> */
    private array $requests = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->member = self::service(UserRegistrar::class)->register('phone@example.com', 'Ada', self::PASSWORD)->user;
        self::onboard($this->member);
    }

    #[Test]
    public function expoTakesTheMessageWithItsCollapseKeyWithinTheWorkersLimit(): void
    {
        $this->registerPhone();

        $ticket = $this->sender(['data' => [['status' => 'ok', 'id' => 'ticket-1']]])->send(...$this->message('rsvp:event-1'));

        self::assertSame('ticket-1', $ticket);
        self::assertSame('https://exp.test/--/api/v2/push/send', $this->requests[0]['url']);
        self::assertSame((float) WorkNotificationsCommand::PROVIDER_CALL_LIMIT, $this->requests[0]['options']['max_duration']);
        self::assertSame(
            [['to' => self::TOKEN, 'title' => 'Ada replied', 'body' => 'Going', 'data' => ['place' => '/events/1', 'recipient' => $this->member->getId()->toRfc4122()], 'collapseId' => 'rsvp:event-1', 'threadId' => 'rsvp:event-1', 'tag' => 'rsvp:event-1']],
            Json\decode(Type\string()->coerce($this->requests[0]['options']['body'])),
        );
    }

    #[Test]
    public function aPhoneExpoNoLongerKnowsIsForgotten(): void
    {
        $this->registerPhone();
        $sender = $this->sender(['data' => [['status' => 'error', 'message' => '"' . self::TOKEN . '" is not a registered push notification recipient', 'details' => ['error' => 'DeviceNotRegistered']]]]);

        try {
            $sender->send(...$this->message(null));
            self::fail('A gone device was taken for a sent message.');
        } catch (Unreachable) {
        }

        self::assertSame(0, self::service(Connection::class)->fetchOne('SELECT count(*) FROM push_targets'));
    }

    #[Test]
    public function aRefusalIsAFailedAttemptThatNeverQuotesTheToken(): void
    {
        $this->registerPhone();
        $sender = $this->sender(['data' => [['status' => 'error', 'message' => '"' . self::TOKEN . '" is rate limited', 'details' => ['error' => 'MessageRateExceeded']]]]);

        try {
            $sender->send(...$this->message(null));
            self::fail('A refused message was taken for a sent one.');
        } catch (Unreachable $unreachable) {
            self::fail('A retryable refusal was recorded as unreachable: ' . $unreachable->getMessage());
        } catch (RuntimeException $refusal) {
            self::assertSame('The Expo push service answered MessageRateExceeded.', $refusal->getMessage());
            self::assertFalse(Str\contains($refusal->getMessage(), 'PushToken'));
        }

        self::assertSame(1, self::service(Connection::class)->fetchOne('SELECT count(*) FROM push_targets'));
    }

    #[Test]
    public function aSignedOutPhoneIsNotSentTo(): void
    {
        $session = $this->registerPhone();
        self::service(Connection::class)->executeStatement('UPDATE refresh_tokens SET revoked_at = now() WHERE chain_id = :chain', ['chain' => $session->toRfc4122()]);

        $this->expectException(Unreachable::class);

        $this->sender(['data' => [['status' => 'ok', 'id' => 'ticket-1']]])->send(...$this->message(null));
    }

    private function registerPhone(): Uuid
    {
        $session = self::service(TokenIssuer::class)->issueFor($this->member)->sessionId;
        self::em()->flush();
        self::service(PushTargets::class)->register($this->member->getId(), $session, PushTargetKind::Expo, self::TOKEN);

        return $session;
    }

    /** @param array<string, mixed> $answer */
    private function sender(array $answer): PushSender
    {
        $http = new MockHttpClient(function (string $method, string $url, array $options) use ($answer): MockResponse {
            $this->requests[] = ['url' => $url, 'options' => $options];

            return new MockResponse(Json\encode($answer), ['http_code' => 200]);
        });

        return new PushSender(self::service(PushTargets::class), [new ExpoPushService($http, 'https://exp.test', '', WorkNotificationsCommand::PROVIDER_CALL_LIMIT)]);
    }

    /** @return array{Uuid, Recipient, NotificationCategory, RenderedNotification, ?string} */
    private function message(?string $collapseKey): array
    {
        return [
            Uuid::v7(),
            new Recipient(NotificationAudienceKind::Member, $this->member->getId(), 'Ada', 'en', null),
            NotificationCategory::EventChanges,
            new RenderedNotification('Ada replied', 'Going', [], '/events/1'),
            $collapseKey,
        ];
    }
}
