<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Monolog\Logger;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Sabre\VObject\Component;
use Sabre\VObject\Component\VCalendar;
use Sabre\VObject\Component\VEvent;
use Sabre\VObject\Property;
use Sabre\VObject\Reader;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Add to calendar on the guest's own page (sc-3627): one VEVENT for a Coming guest, kept current, and ended with the link. */
final class GuestCalendarFeedTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function aComingGuestsFeedIsValidWithOneEventInItsZoneAndALinkBackToTheirPage(): void
    {
        self::service(Connection::class)->executeStatement("UPDATE events SET venue_name = 'The Civic Centre', venue_address = 'Ozumba Mbadiwe Ave, Lagos' WHERE id = :id", ['id' => $this->eventId]);
        $guest = $this->add('Adaeze Okonkwo');
        $token = $this->token($guest);
        $page = $this->reply($token, 'coming');
        $path = Type\string()->coerce($page['calendarFeed'] ?? null);

        $calendar = $this->parse($this->fetch($path));

        self::assertSame('/api/guest-calendars/' . $token . '.ics', $path);
        self::assertSame('text/calendar; charset=utf-8', $this->client->getResponse()->headers->get('Content-Type'));
        self::assertSame([], Vec\filter($calendar->validate(), static fn (array $warning): bool => $warning['level'] > 1), 'RFC 5545 warnings');
        self::assertSame(['Africa/Lagos'], Vec\map($this->components($calendar, 'VTIMEZONE'), static fn (Component $zone): string => self::value($zone, 'TZID')));
        $event = $this->only($calendar);
        self::assertSame('guest-' . $guest . '@soirely', self::value($event, 'UID'));
        self::assertSame("Amara & Tobi's wedding", self::value($event, 'SUMMARY'));
        self::assertSame('20301114T160000', self::value($event, 'DTSTART'));
        self::assertStringStartsWith('DTSTART;TZID=Africa/Lagos:', self::property($event, 'DTSTART')?->serialize() ?? '');
        self::assertSame('The Civic Centre, Ozumba Mbadiwe Ave, Lagos', self::value($event, 'LOCATION'));
        self::assertSame('https://app.soirely.test/i/' . $token, self::value($event, 'URL'));
        self::assertSame('CONFIRMED', self::value($event, 'STATUS'));
    }

    #[Test]
    public function changingFromComingDropsTheEventAndChangingBackReturnsItUnderTheSameUid(): void
    {
        $token = $this->token($this->add('Adaeze Okonkwo'));
        $path = $this->feedOf($this->reply($token, 'coming'));
        $uid = self::value($this->only($this->parse($this->fetch($path))), 'UID');

        foreach (['notComing', 'maybe'] as $answer) {
            $page = $this->reply($token, $answer);
            $calendar = $this->parse($this->fetch($path));

            self::assertNull($page['calendarFeed'] ?? null, $answer);
            self::assertSame([], $this->components($calendar, 'VEVENT'), $answer);
            self::assertCount(1, $this->components($calendar, 'VTIMEZONE'), $answer);
            self::assertSame([], Vec\filter($calendar->validate(), static fn (array $warning): bool => $warning['level'] > 1), $answer);

            $this->reply($token, 'coming');
            self::assertSame($uid, self::value($this->only($this->parse($this->fetch($path))), 'UID'), $answer);
        }
    }

    #[Test]
    public function aMovedTimeUpdatesInPlaceUnderTheSameUidWithAHigherSequence(): void
    {
        $path = $this->feedOf($this->reply($this->token($this->add('Adaeze Okonkwo')), 'coming'));
        $before = $this->only($this->parse($this->fetch($path)));

        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as($this->owner, 'PATCH', '/api/events/' . $this->eventId, ['startsAt' => '2030-11-21T16:00', 'endsAt' => '2030-11-22T02:00'], ['HTTP_IF_MATCH' => $tag]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $after = $this->only($this->parse($this->fetch($path)));

        self::assertSame(self::value($before, 'UID'), self::value($after, 'UID'));
        self::assertSame('20301121T160000', self::value($after, 'DTSTART'));
        self::assertGreaterThan((int) self::value($before, 'SEQUENCE'), (int) self::value($after, 'SEQUENCE'));
    }

    #[Test]
    public function aPausedEventLeavesTheFeedAsItWasAndTakesTheFeedOffThePage(): void
    {
        $token = $this->token($this->add('Adaeze Okonkwo'));
        $path = $this->feedOf($this->reply($token, 'coming'));
        $before = $this->fetch($path);

        $this->lifecycle('pause');

        self::assertNull($this->open($token)['calendarFeed'] ?? null);
        self::assertSame($before, $this->fetch($path));

        $this->lifecycle('resume');

        self::assertSame($path, $this->open($token)['calendarFeed'] ?? null);
    }

    #[Test]
    public function aCalledOffEventIsCancelledWhereItWasHeldGainsNoneElsewhereAndIsGoneAfterThirtyDays(): void
    {
        $coming = $this->feedOf($this->reply($this->token($this->add('Adaeze Okonkwo')), 'coming'));
        $notComingToken = $this->token($this->add('Obi Okonkwo'));
        $this->reply($notComingToken, 'notComing');
        $notComing = '/api/guest-calendars/' . $notComingToken . '.ics';

        $this->lifecycle('end');

        self::assertSame('CANCELLED', self::value($this->only($this->parse($this->fetch($coming))), 'STATUS'));
        self::assertSame([], $this->components($this->parse($this->fetch($notComing)), 'VEVENT'));
        self::assertNull($this->open($notComingToken)['calendarFeed'] ?? null);

        self::mockTime(new DateTimeImmutable('2026-11-16T13:21:00+00:00'));

        $this->fetch($coming);
        self::assertSame(404, $this->statusCode());
        $this->fetch($notComing);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aDeletedEventIsCancelledForThirtyDaysThenNotFound(): void
    {
        $path = $this->feedOf($this->reply($this->token($this->add('Adaeze Okonkwo')), 'coming'));

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId, ['name' => "Amara & Tobi's wedding"]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();

        self::assertSame('CANCELLED', self::value($this->only($this->parse($this->fetch($path))), 'STATUS'));

        self::mockTime(new DateTimeImmutable('2026-11-16T13:21:00+00:00'));
        $this->fetch($path);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aReplacedLinksFeedIsNotFound(): void
    {
        $guest = $this->add('Adaeze Okonkwo');
        $path = $this->feedOf($this->reply($this->token($guest), 'coming'));

        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link/replace');
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        $this->fetch($path);

        self::assertSame(404, $this->statusCode());
        $this->fetch('/api/guest-calendars/' . Str\repeat('a', 43) . '.ics');
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function theFeedHoldsNothingAboutOtherGuests(): void
    {
        $path = $this->feedOf($this->reply($this->token($this->add('Adaeze Okonkwo', ['Ngozi Okonkwo'])), 'coming'));
        $this->reply($this->token($this->add('Obi Chukwuemeka')), 'coming');

        $body = $this->fetch($path);

        self::assertCount(1, $this->components($this->parse($body), 'VEVENT'));

        foreach (['Adaeze', 'Ngozi', 'Obi', 'Chukwuemeka'] as $name) {
            self::assertStringNotContainsString($name, $body);
        }
    }

    #[Test]
    public function theTokenIsInNoLogRecordAFetchWrites(): void
    {
        $token = $this->token($this->add('Adaeze Okonkwo'));
        $this->reply($token, 'coming');
        $records = new TestHandler();
        foreach (['logger', 'monolog.logger.request'] as $channel) {
            self::serviceById($channel, Logger::class)->pushHandler($records);
        }

        $this->fetch('/api/guest-calendars/' . $token . '.ics');

        self::assertSame(200, $this->statusCode());
        self::assertTrue($records->hasRecordThatContains('Matched route', Level::Info), 'the router logged nothing, so nothing was checked');
        foreach ($records->getRecords() as $record) {
            self::assertStringNotContainsString($token, Json\encode([$record->message, $record->context, $record->extra]));
        }
    }

    /** @param array<string, mixed> $page */
    private function feedOf(array $page): string
    {
        return Type\string()->coerce($page['calendarFeed'] ?? null);
    }

    private function fetch(string $path): string
    {
        $this->client->request('GET', $path);

        return (string) $this->client->getResponse()->getContent();
    }

    private function parse(string $body): VCalendar
    {
        self::assertSame(200, $this->statusCode(), $body);
        $calendar = Reader::read($body);
        self::assertInstanceOf(VCalendar::class, $calendar);

        return $calendar;
    }

    /** @return list<Component> */
    private function components(VCalendar $calendar, string $name): array
    {
        $components = [];

        foreach ($calendar->select($name) as $component) {
            if ($component instanceof Component) {
                $components[] = $component;
            }
        }

        return $components;
    }

    private function only(VCalendar $calendar): VEvent
    {
        $events = $this->components($calendar, 'VEVENT');
        self::assertCount(1, $events);
        self::assertInstanceOf(VEvent::class, $events[0]);

        return $events[0];
    }

    private static function property(Component $component, string $name): ?Property
    {
        foreach ($component->select($name) as $property) {
            if ($property instanceof Property) {
                return $property;
            }
        }

        return null;
    }

    private static function value(Component $component, string $name): string
    {
        return self::property($component, $name)?->__toString() ?? '';
    }

    /** @param list<string> $companions */
    private function add(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        return $this->anonymous('/api/guest-links/page', ['token' => $token]);
    }

    /** @return array<string, mixed> */
    private function reply(#[SensitiveParameter] string $token, string $answer): array
    {
        $page = $this->anonymous('/api/guest-links/reply', ['token' => $token, 'answer' => $answer]);
        self::assertSame(200, $this->statusCode(), Json\encode($page));

        return $page;
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function anonymous(string $path, #[SensitiveParameter] array $body): array
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));

        return $this->last();
    }

    private function lifecycle(string $action): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/' . $action);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function live(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string>     $headers
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, array $headers = []): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...$headers,
        ], content: null === $body ? null : Json\encode($body));

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
