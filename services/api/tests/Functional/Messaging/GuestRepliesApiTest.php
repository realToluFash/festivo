<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\GuestReplies\GuestRepliesUnsubscribe;
use App\Domain\Messaging\GuestReplies\GuestReplyLog;
use App\Domain\Messaging\GuestReplies\GuestReplyRecorder;
use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Domain\Messaging\NotificationWorker;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\EventType;
use App\Enum\GuestInvitationMethod;
use App\Enum\GuestReply;
use App\Enum\GuestReplySource;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** sc-4331: Changed since you looked on the guest list, and the summary's unsubscribe link. */
final class GuestRepliesApiTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Event $event;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-11-02 09:00', new DateTimeZone('UTC')));
        $this->owner = self::service(UserRegistrar::class)->register('folake@ire.events', 'Folake', self::PASSWORD)->user;
        self::onboard($this->owner, withOrganisation: false);
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->event = $this->wedding($organisation);
    }

    #[Test]
    public function theListCountsFromTheTimeInTheAddressAndMarksNothingRead(): void
    {
        $tomi = $this->reply('Tomi Bello', GuestReply::Coming);
        self::mockTime(new DateTimeImmutable('2026-11-02 09:10', new DateTimeZone('UTC')));
        $kemi = $this->guest('Kemi Ade');
        self::em()->wrapInTransaction(static fn () => self::service(GuestReplyRecorder::class)->needs($kemi));
        $this->work();

        $all = $this->as('GET', $this->path('?since=all'));
        self::assertSame(200, $this->statusCode());
        self::assertSame('all', $all['since']);
        self::assertSame([
            ['guestId' => $kemi->getId()->toRfc4122(), 'kind' => 'needs', 'at' => '2026-11-02T09:10:00+00:00'],
            ['guestId' => $tomi->getId()->toRfc4122(), 'kind' => 'replied', 'at' => '2026-11-02T09:00:00+00:00'],
        ], $all['rows']);

        $later = $this->as('GET', $this->path('?since=' . \rawurlencode('2026-11-02T09:05:00+00:00')));
        self::assertSame([$kemi->getId()->toRfc4122()], Vec\map(Type\vec(Type\dict(Type\string(), Type\string()))->coerce($later['rows']), static fn (array $row): string => $row['guestId']));
        self::assertSame(1, $this->unread());
    }

    #[Test]
    public function choosingTheFilterIsALookThatMarksTheItemReadAndTheMenuCountsFromIt(): void
    {
        $this->reply('Tomi Bello', GuestReply::Coming);
        self::assertSame(1, $this->unread());
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->as('GET', $this->path())['rows']));

        self::mockTime(new DateTimeImmutable('2026-11-02 09:30', new DateTimeZone('UTC')));
        $chosen = $this->as('POST', $this->path('/look'));

        self::assertSame(200, $this->statusCode());
        self::assertSame('all', $chosen['since']);
        self::assertCount(1, Type\vec(Type\mixed())->coerce($chosen['rows']));
        self::assertSame(0, $this->unread());
        self::assertSame('2026-11-02T09:30:00+00:00', $this->as('GET', $this->path())['since']);
        self::assertSame([], $this->as('GET', $this->path())['rows']);
    }

    #[Test]
    public function aStrangerToTheEventCannotReadItsChanges(): void
    {
        $stranger = self::service(UserRegistrar::class)->register('tomi@example.com', 'Tomi', self::PASSWORD)->user;
        self::onboard($stranger);

        $this->as('GET', $this->path(), $stranger);

        self::assertContains($this->statusCode(), [403, 404]);
    }

    #[Test]
    public function openingTheLinkTwiceChangesNothingAndSendsThePageTheTokenAfterItsHash(): void
    {
        $token = $this->token();

        foreach ([1, 2] as $_) {
            $this->client->request('GET', '/api/unsubscribe/guest-replies/' . $token);
            $response = $this->client->getResponse();
            self::assertSame(303, $response->getStatusCode());
            self::assertSame('https://app.soirely.test/unsubscribe/guest-replies#' . $token, $response->headers->get('Location'));
            self::assertSame('no-referrer', $response->headers->get('Referrer-Policy'));
            self::assertSame('noindex, nofollow', $response->headers->get('X-Robots-Tag'));
        }

        self::assertTrue($this->emailOn());
    }

    #[Test]
    public function theOneClickPostSwitchesEmailOffEachTimeItIsMadeAfterTurnThemBackOnToo(): void
    {
        $token = $this->token();

        $this->oneClick($token);
        self::assertSame(200, $this->statusCode());
        self::assertSame('', (string) $this->client->getResponse()->getContent());
        self::assertFalse($this->emailOn());

        self::assertSame(['emailOn' => true], $this->page('PUT', ['token' => $token, 'emailOn' => true]));
        self::assertTrue($this->emailOn());

        $this->oneClick($token);
        self::assertSame(200, $this->statusCode());
        self::assertFalse($this->emailOn());
    }

    #[Test]
    public function thePageAsksAndSetsWithTheTokenInTheBodyAndLearnsNothingElse(): void
    {
        $token = $this->token();

        self::assertSame(['emailOn' => true], $this->page('POST', ['token' => $token]));
        self::assertSame(['emailOn' => false], $this->page('PUT', ['token' => $token, 'emailOn' => false]));
        self::assertSame(['emailOn' => false], $this->page('POST', ['token' => $token]));
        self::assertSame('no-referrer', $this->client->getResponse()->headers->get('Referrer-Policy'));
    }

    #[Test]
    public function aTamperedTokenChangesNothingByPostOrByGet(): void
    {
        $token = $this->token();
        $tampered = Str\slice($token, 0, 43) . ('A' === Str\slice($token, 43) ? 'B' : 'A');

        $this->oneClick($tampered);
        self::assertSame(404, $this->statusCode());
        $this->page('PUT', ['token' => $tampered, 'emailOn' => false]);
        self::assertSame(404, $this->statusCode());
        $this->page('POST', ['token' => $tampered]);
        self::assertSame(404, $this->statusCode());

        self::assertTrue($this->emailOn());
    }

    #[Test]
    public function aLinkFromASummarySentMoreThanSixtyDaysAgoStillWorks(): void
    {
        $token = $this->token();
        self::mockTime(new DateTimeImmutable('2027-02-01 09:00', new DateTimeZone('UTC')));

        $this->oneClick($token);

        self::assertSame(200, $this->statusCode());
        self::assertFalse($this->emailOn());
    }

    private function token(): string
    {
        return self::service(GuestRepliesUnsubscribe::class)->token($this->owner->getId());
    }

    private function oneClick(#[\SensitiveParameter] string $token): void
    {
        $this->client->request('POST', '/api/unsubscribe/guest-replies/' . $token, ['List-Unsubscribe' => 'One-Click'], server: ['CONTENT_TYPE' => 'application/x-www-form-urlencoded']);
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function page(string $method, array $body): array
    {
        $this->client->request($method, '/api/unsubscribe/guest-replies', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function emailOn(): bool
    {
        return self::service(NotificationPreferencesInterface::class)->allows($this->owner->getId(), NotificationCategory::GuestReplies, NotificationChannel::Email);
    }

    private function wedding(Organisation $organisation): Event
    {
        $starts = new DateTimeImmutable('2026-11-12 18:00', new DateTimeZone('Africa/Lagos'));
        $event = new Event($organisation, 'Gala', EventType::Wedding, $starts, $starts->modify('+5 hours'), 'NGN');
        $event->makeLive(self::service(ClockInterface::class)->now());
        self::em()->persist($event);
        self::em()->flush();

        return $event;
    }

    private function guest(string $name): Guest
    {
        $guest = Guest::listed($this->event, $name, Str\lowercase($name), null, null, null, Uuid::v4()->toRfc4122());
        $guest->invite(GuestInvitationMethod::InPerson, self::service(ClockInterface::class)->now(), null);
        self::em()->persist($guest);
        self::em()->flush();

        return $guest;
    }

    private function reply(string $name, GuestReply $answer): Guest
    {
        $guest = $this->guest($name);
        self::em()->wrapInTransaction(static function () use ($guest, $answer): void {
            $guest->reply($answer, self::service(ClockInterface::class)->now(), GuestReplySource::GuestPage);
            self::em()->flush();
            self::service(GuestReplyRecorder::class)->replied($guest, null);
        });
        $this->work();

        return $guest;
    }

    private function work(): void
    {
        $steps = 0;

        while ($steps < 100 && self::service(NotificationWorker::class)->step()) {
            ++$steps;
        }
    }

    private function unread(): int
    {
        return Type\int()->coerce(self::service(Connection::class)->fetchOne(
            'SELECT COUNT(*) FROM notification_items WHERE user_id = :user AND thread = :thread AND read_at IS NULL',
            ['user' => $this->owner->getId()->toRfc4122(), 'thread' => GuestReplyLog::thread($this->event->getId()->toRfc4122())],
        ));
    }

    private function path(string $rest = ''): string
    {
        return '/api/events/' . $this->event->getId()->toRfc4122() . '/guests/changes' . $rest;
    }

    /** @return array<string, mixed> */
    private function as(string $method, string $path, ?User $user = null): array
    {
        $who = self::em()->find(User::class, ($user ?? $this->owner)->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ]);
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
