<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Organisation;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** A guest tells the kitchen their own needs and their companions' from their page (sc-3778): one record with the hosts' (sc-3777), never the private note. */
final class GuestPageNeedsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NOTE = 'Carries an EpiPen in her bag';

    private const array NONE = [
        'allergies' => [],
        'diet' => [],
        'access' => [],
        'otherAllergy' => null,
        'otherDiet' => null,
        'otherAccess' => null,
    ];

    private User $owner;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live($organisation);
    }

    #[Test]
    public function thePageShowsWhatTheHostsRecordedButNeverTheirNote(): void
    {
        $guest = $this->add(['needs' => ['allergies' => ['peanuts'], 'access' => ['step_free'], 'note' => self::NOTE], 'companions' => [['fullName' => 'Tunde', 'needs' => ['diet' => ['vegan']]], ['fullName' => null]]]);

        $page = $this->open($this->token($guest));

        self::assertSame([
            [...self::NONE, 'allergies' => ['peanuts'], 'access' => ['step_free'], 'changed' => ['by' => 'hosts', 'at' => '2026-10-03T10:00:00+01:00']],
            [...self::NONE, 'diet' => ['vegan'], 'changed' => ['by' => 'hosts', 'at' => '2026-10-03T10:00:00+01:00']],
        ], $this->pageNeeds($page));
        self::assertStringNotContainsString(self::NOTE, Json\encode($page));
        self::assertStringNotContainsString('"note"', Json\encode($page));
    }

    #[Test]
    public function aPersonNobodyHasRecordedAnythingForHasNoLastChange(): void
    {
        $page = $this->open($this->token($this->add(['companions' => [['fullName' => 'Tunde']]])));

        self::assertSame([[...self::NONE, 'changed' => null], [...self::NONE, 'changed' => null]], $this->pageNeeds($page));
    }

    #[Test]
    public function comingWithNeedsRoundTripsTheirCodesForEachPersonAndKeepsTheHostsNote(): void
    {
        $guest = $this->add(['needs' => ['note' => self::NOTE], 'companions' => [['fullName' => 'Tunde'], ['fullName' => null]]]);
        $token = $this->token($guest);
        $tunde = $this->companionIds($this->open($token))[0];
        self::mockTime(new DateTimeImmutable('2026-10-05T18:30:00+00:00'));

        $page = $this->reply($token, 'coming', [
            'needs' => ['allergies' => ['sesame', 'peanuts', 'other'], 'otherAllergy' => '  Kiwi ', 'diet' => ['halal', 'other'], 'otherDiet' => 'No raw onion'],
            'companions' => [
                ['id' => $tunde, 'fullName' => 'Tunde', 'coming' => true, 'needs' => ['diet' => ['vegetarian']]],
                ['fullName' => 'Kemi Adewale', 'coming' => true, 'needs' => ['access' => ['other'], 'otherAccess' => 'A chair by the door']],
            ],
        ]);

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        $byGuest = ['by' => 'guest', 'at' => '2026-10-05T19:30:00+01:00'];
        self::assertSame([
            [...self::NONE, 'allergies' => ['peanuts', 'sesame', 'other'], 'otherAllergy' => 'Kiwi', 'diet' => ['halal', 'other'], 'otherDiet' => 'No raw onion', 'changed' => $byGuest],
            [...self::NONE, 'diet' => ['vegetarian'], 'changed' => $byGuest],
            [...self::NONE, 'access' => ['other'], 'otherAccess' => 'A chair by the door', 'changed' => $byGuest],
        ], $this->pageNeeds($page));
        $details = $this->details($guest);
        self::assertSame(self::NOTE, $details['needs']['note'] ?? null);
        self::assertSame($byGuest, $details['needs']['changed'] ?? null);
        self::assertSame($byGuest, $details['companions'][1]['needs']['changed'] ?? null);
        self::assertCount(4, self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestNeedsRecord::CHANGED]), 'the hosts\' note, then the guest and each companion');
    }

    #[Test]
    public function theGuestAndTheHostsChangeOneRecordAndWhoeverSavedLastWins(): void
    {
        $guest = $this->add(['needs' => ['allergies' => ['milk'], 'diet' => ['other'], 'otherDiet' => 'Small portions']]);
        $token = $this->token($guest);
        self::mockTime(new DateTimeImmutable('2026-10-04T09:00:00+00:00'));

        $this->reply($token, 'coming', ['needs' => ['allergies' => ['milk', 'eggs'], 'diet' => []]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[...self::NONE, 'allergies' => ['eggs', 'milk'], 'changed' => ['by' => 'guest', 'at' => '2026-10-04T10:00:00+01:00']]], $this->pageNeeds($this->open($token)));

        self::mockTime(new DateTimeImmutable('2026-10-06T09:00:00+00:00'));
        $this->as('PUT', $this->guests() . '/' . $guest, ['fullName' => 'Bisi Adewale', 'companions' => [], 'needs' => ['allergies' => ['eggs']]], $this->tag($guest));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[...self::NONE, 'allergies' => ['eggs'], 'changed' => ['by' => 'hosts', 'at' => '2026-10-06T10:00:00+01:00']]], $this->pageNeeds($this->open($token)));
    }

    #[Test]
    public function aGuestRemovesAnAccessNeedTheHostsPickedButCannotAddOne(): void
    {
        $guest = $this->add(['needs' => ['access' => ['step_free', 'near_exit']]]);
        $token = $this->token($guest);

        $this->reply($token, 'coming', ['needs' => ['access' => ['near_exit', 'hearing_loop']]]);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['needs.access' => 'Choose from the list.'], $this->violations());
        self::assertNull($this->open($token)['guest']['reply'] ?? null);

        $page = $this->reply($token, 'coming', ['needs' => ['access' => ['near_exit']]]);

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        self::assertSame(['near_exit'], $this->pageNeeds($page)[0]['access'] ?? null);
        self::assertSame('guest', $this->pageNeeds($page)[0]['changed']['by'] ?? null);
    }

    #[Test]
    public function anUnknownCodeIsRefusedAndNothingIsSaved(): void
    {
        $guest = $this->add(['companions' => [['fullName' => 'Tunde']]]);
        $token = $this->token($guest);
        $tunde = $this->companionIds($this->open($token))[0];

        $this->reply($token, 'coming', [
            'needs' => ['allergies' => ['peanuts', 'shellfish']],
            'companions' => [['id' => $tunde, 'fullName' => 'Tunde', 'coming' => false, 'needs' => ['diet' => ['other'], 'otherDiet' => Str\repeat('d', 101)]]],
        ]);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([
            'needs.allergies' => 'Choose from the list.',
            'companions[0].needs.otherDiet' => 'Shorten it to 100 characters or fewer.',
        ], $this->violations());
        $page = $this->open($token);
        self::assertNull($page['guest']['reply'] ?? null);
        self::assertSame([[...self::NONE, 'changed' => null], [...self::NONE, 'changed' => null]], $this->pageNeeds($page));
        self::assertTrue($page['guest']['companions'][0]['coming'] ?? null);
    }

    #[Test]
    public function aReplyWithoutNeedsAndNotComingLeaveTheRecordAsItIs(): void
    {
        $guest = $this->add(['needs' => ['allergies' => ['fish']]]);
        $token = $this->token($guest);
        $before = $this->pageNeeds($this->open($token));

        $this->reply($token, 'coming', []);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->reply($token, 'notComing', ['needs' => ['allergies' => []]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->reply($token, 'coming', ['needs' => ['allergies' => ['fish']]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame($before, $this->pageNeeds($this->open($token)));
        self::assertCount(1, self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestNeedsRecord::CHANGED]));
    }

    #[Test]
    public function aGuestWhoClearsTheHostsWordsRemovesThatOther(): void
    {
        $guest = $this->add(['needs' => ['diet' => ['vegan', 'other'], 'otherDiet' => 'Small portions', 'access' => ['other'], 'otherAccess' => 'Lift']]);
        $token = $this->token($guest);

        $page = $this->reply($token, 'coming', ['needs' => ['diet' => ['vegan'], 'otherDiet' => null, 'access' => []]]);

        self::assertSame(200, $this->statusCode(), Json\encode($page));
        $needs = $this->pageNeeds($page)[0];
        unset($needs['changed']);
        self::assertSame([...self::NONE, 'diet' => ['vegan']], $needs);
    }

    #[Test]
    public function needsCannotBeSentFromTheStart(): void
    {
        $token = $this->token($this->add([]));
        self::mockTime(new DateTimeImmutable('2030-11-14T15:00:00+00:00'));

        $this->reply($token, 'coming', ['needs' => ['allergies' => ['peanuts']]]);

        self::assertSame(409, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => GuestNeedsRecord::CHANGED]));
    }

    /** @return list<array<string, mixed>> the guest's, then each named companion's */
    private function pageNeeds(mixed $page): array
    {
        $guest = Type\dict(Type\string(), Type\mixed())->coerce(Type\dict(Type\string(), Type\mixed())->coerce($page)['guest'] ?? null);

        return [
            Type\dict(Type\string(), Type\mixed())->coerce($guest['needs'] ?? null),
            ...Vec\map(
                Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($guest['companions'] ?? []),
                static fn (array $companion): array => Type\dict(Type\string(), Type\mixed())->coerce($companion['needs'] ?? null),
            ),
        ];
    }

    /** @return list<string> */
    private function companionIds(mixed $page): array
    {
        $guest = Type\dict(Type\string(), Type\mixed())->coerce(Type\dict(Type\string(), Type\mixed())->coerce($page)['guest'] ?? null);

        return Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($guest['companions'] ?? []), static fn (array $one): string => $one['id']);
    }

    /** @param array<string, mixed> $guest */
    private function add(array $guest): string
    {
        $this->as('POST', $this->guests(), ['fullName' => 'Bisi Adewale', 'companions' => [], ...$guest]);
        $body = $this->last();
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    /** @return array<string, mixed> */
    private function details(string $guest): array
    {
        $this->as('GET', $this->guests() . '/' . $guest);

        return Type\dict(Type\string(), Type\mixed())->coerce($this->last()['guest'] ?? null);
    }

    private function tag(string $guest): string
    {
        $this->as('GET', $this->guests() . '/' . $guest);

        return (string) $this->client->getResponse()->headers->get('ETag');
    }

    private function token(string $guest): string
    {
        $this->as('GET', $this->guests() . '/' . $guest . '/link');
        $body = $this->last();
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    /** @return array<string, mixed> */
    private function open(#[SensitiveParameter] string $token): array
    {
        $this->anonymous('/api/guest-links/page', ['token' => $token]);

        return $this->last();
    }

    /** @param array<string, mixed> $with */
    private function reply(#[SensitiveParameter] string $token, string $answer, array $with): mixed
    {
        return $this->anonymous('/api/guest-links/reply', ['token' => $token, 'answer' => $answer, ...$with]);
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): mixed
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));

        return $this->last();
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Iter\reduce($violations, static fn (array $all, array $one): array => [...$all, $one['propertyPath'] => $one['message']], []);
    }

    private function live(Organisation $organisation): string
    {
        $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        $body = $this->last();
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as('POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed>|null $body */
    private function as(string $method, string $path, ?array $body = null, ?string $ifMatch = null): mixed
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
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
