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
use App\Integrations\WebPush\VapidWebPush;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\DBAL\Connection;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Str\Byte;
use Psl\Type;
use Psr\Http\Message\RequestInterface;
use RuntimeException;
use Symfony\Component\Uid\Uuid;

/** The Web Push half against a recorded Guzzle handler, with a subscription's keys made as a browser makes them. */
final class WebPushSenderTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ENDPOINT = 'https://fcm.googleapis.com/fcm/send/a-browsers-own-endpoint';

    private User $member;

    /** @var list<RequestInterface> */
    private array $requests = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->member = self::service(UserRegistrar::class)->register('laptop@example.com', 'Ada', self::PASSWORD)->user;
        self::onboard($this->member);
    }

    #[Test]
    public function theTopicIsTheCollapseKeysHashCutToThirtyTwo(): void
    {
        $this->registerBrowser();

        $sent = $this->sender(new Response(201, ['Location' => 'https://fcm.googleapis.com/message/1']))->send(...$this->message('rsvp:event-1'));

        self::assertSame('https://fcm.googleapis.com/message/1', $sent);
        $request = $this->requests[0];
        self::assertSame(self::ENDPOINT, (string) $request->getUri());
        self::assertSame('zB3tAvRvau6F1f5VYMiXq0cMbkCIe-QS', $request->getHeaderLine('Topic'));
    }

    #[Test]
    public function noCollapseKeySendsNoTopic(): void
    {
        $this->registerBrowser();

        $this->sender(new Response(201))->send(...$this->message(null));

        self::assertFalse($this->requests[0]->hasHeader('Topic'));
    }

    #[Test]
    #[DataProvider('gone')]
    public function aSubscriptionThePushServiceNoLongerKnowsIsForgotten(int $status): void
    {
        $this->registerBrowser();

        try {
            $this->sender(new Response($status))->send(...$this->message(null));
            self::fail('A gone subscription was taken for a sent message.');
        } catch (Unreachable) {
        }

        self::assertSame(0, self::service(Connection::class)->fetchOne('SELECT count(*) FROM push_targets'));
    }

    /** @return iterable<string, array{int}> */
    public static function gone(): iterable
    {
        yield 'not found' => [404];
        yield 'gone' => [410];
    }

    #[Test]
    public function aRefusalIsAFailedAttemptThatNeverQuotesTheEndpoint(): void
    {
        $this->registerBrowser();

        try {
            $this->sender(new Response(429, [], 'Too many for ' . self::ENDPOINT))->send(...$this->message(null));
            self::fail('A refused message was taken for a sent one.');
        } catch (Unreachable $unreachable) {
            self::fail('A retryable refusal was recorded as unreachable: ' . $unreachable->getMessage());
        } catch (RuntimeException $refusal) {
            self::assertSame('Web Push answered 429.', $refusal->getMessage());
            self::assertFalse(Str\contains($refusal->getMessage(), 'fcm.googleapis.com'));
        }

        self::assertSame(1, self::service(Connection::class)->fetchOne('SELECT count(*) FROM push_targets'));
    }

    private function registerBrowser(): void
    {
        $session = self::service(TokenIssuer::class)->issueFor($this->member)->sessionId;
        self::em()->flush();
        [$publicKey, $authSecret] = self::browserKeys();
        self::service(PushTargets::class)->register($this->member->getId(), $session, PushTargetKind::Web, self::ENDPOINT, $publicKey, $authSecret);
    }

    /** @return array{string, string} the p256dh point and the auth secret, URL-safe base64 as a browser hands them over */
    private static function browserKeys(): array
    {
        $key = \openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => \OPENSSL_KEYTYPE_EC]);
        self::assertNotFalse($key);
        $details = \openssl_pkey_get_details($key);
        self::assertIsArray($details);
        $ec = Type\shape(['x' => Type\string(), 'y' => Type\string()], true)->coerce($details['ec'] ?? null);

        return [
            self::base64Url("\x04" . Byte\pad_left($ec['x'], 32, "\0") . Byte\pad_left($ec['y'], 32, "\0")),
            self::base64Url(SecureRandom\bytes(16)),
        ];
    }

    private static function base64Url(string $bytes): string
    {
        return Str\trim_right(Str\replace_every(\base64_encode($bytes), ['+' => '-', '/' => '_']), '=');
    }

    private function sender(Response $answer): PushSender
    {
        $handler = HandlerStack::create(new MockHandler([function (RequestInterface $request) use ($answer): Response {
            $this->requests[] = $request;

            return $answer;
        }]));

        return new PushSender(self::service(PushTargets::class), [new VapidWebPush(
            'mailto:support@soirely.com',
            Type\string()->coerce($_ENV['VAPID_PUBLIC_KEY'] ?? $_SERVER['VAPID_PUBLIC_KEY']),
            Type\string()->coerce($_ENV['VAPID_PRIVATE_KEY'] ?? $_SERVER['VAPID_PRIVATE_KEY']),
            WorkNotificationsCommand::PROVIDER_CALL_LIMIT,
            $handler,
        )]);
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
