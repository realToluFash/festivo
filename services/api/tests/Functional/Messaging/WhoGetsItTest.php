<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Audience\GuestAudienceResolver;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\GuestMessage;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** Who gets it (sc-3957): conditions on the event's guests, counted live, saved under a name, and resolved when a message goes. */
final class WhoGetsItTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $family;

    /** @var array<string, string> */
    private array $guests = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-11-21T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
        $this->family = $this->group('Family');
        $work = $this->group('Work');
        $this->guest('Ada', invited: true, reply: 'coming', email: true, mobile: true, group: $this->family, companion: 'Ada’s plus one');
        $this->guest('Bayo', invited: true, reply: null, email: true, mobile: false, group: $work);
        $this->guest('Chidi', invited: true, reply: 'notComing', email: false, mobile: true);
        $this->guest('Dami', invited: true, reply: 'maybe', email: true, mobile: false);
        $this->guest('Ebun', invited: false, reply: null, email: true, mobile: false);
    }

    /** @return iterable<string, array{array<string, mixed>, list<string>}> */
    public static function eachCondition(): iterable
    {
        yield 'Has replied: any reply' => [['type' => 'replied'], ['Ada', 'Chidi', 'Dami']];
        yield 'Hasn’t replied: invited with no reply, never Not yet invited' => [['type' => 'notReplied'], ['Bayo']];
        yield 'Is coming' => [['type' => 'coming'], ['Ada']];
        yield 'Isn’t coming' => [['type' => 'notComing'], ['Chidi']];
        yield 'Not sure yet' => [['type' => 'notSure'], ['Dami']];
        yield 'Invited' => [['type' => 'invited'], ['Ada', 'Bayo', 'Chidi', 'Dami']];
        yield 'Not yet invited' => [['type' => 'notInvited'], ['Ebun']];
        yield 'Has an email address' => [['type' => 'hasEmail'], ['Ada', 'Bayo', 'Dami', 'Ebun']];
        yield 'Has a mobile number' => [['type' => 'hasMobile'], ['Ada', 'Chidi']];
        yield 'No group' => [['type' => 'inGroup', 'groupId' => null], ['Chidi', 'Dami', 'Ebun']];
    }

    /** @param list<string> $names */
    #[Test]
    #[DataProvider('eachCondition')]
    public function eachConditionMatchesItsGuestsAndNeverACompanion(mixed $condition, array $names): void
    {
        $match = $this->match([$condition]);

        self::assertSame(200, $this->statusCode(), Json\encode($match));
        self::assertSame($names, $this->names($match));
        self::assertSame(Iter\count($names), $match['count']);
    }

    #[Test]
    public function isInGroupMatchesItsGroupAndSeeWhoGivesEachGuestsChannels(): void
    {
        $match = $this->match([['type' => 'inGroup', 'groupId' => $this->family]]);

        self::assertSame([['id' => $this->guests['Ada'], 'name' => 'Ada', 'email' => true, 'mobile' => true]], $match['guests']);
        self::assertSame([['type' => 'inGroup', 'groupId' => $this->family, 'group' => ['name' => 'Family', 'deleted' => false]]], $match['conditions']);
    }

    #[Test]
    public function conditionsCombineWithAndAndOnesThatExcludeEachOtherMatchNobody(): void
    {
        self::assertSame(['Ada'], $this->names($this->match([['type' => 'invited'], ['type' => 'hasMobile'], ['type' => 'hasEmail']])));
        self::assertSame(['Dami'], $this->names($this->match([['type' => 'hasEmail'], ['type' => 'invited'], ['type' => 'inGroup', 'groupId' => null]])));

        $nobody = $this->match([['type' => 'inGroup', 'groupId' => $this->family], ['type' => 'inGroup', 'groupId' => null]]);
        self::assertSame(0, $nobody['count']);
        $this->send([['type' => 'coming'], ['type' => 'notReplied']]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['nobody_matches'], $this->codes());
    }

    #[Test]
    public function withNoConditionNothingIsCountedSentOrSaved(): void
    {
        $this->match([]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['conditions_required'], $this->codes());

        $this->send([]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['conditions_required'], $this->codes());

        $this->save('Nobody yet', []);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['conditions_required'], $this->codes());
        self::assertSame(0, $this->messageCount());
    }

    #[Test]
    public function anUnknownConditionIsRefusedByName(): void
    {
        $refused = $this->match([['type' => 'coming'], ['type' => 'hasPickedAMeal']]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('There is no condition called hasPickedAMeal.', Type\vec(Type\shape(['message' => Type\string()], true))->coerce($refused['violations'])[0]['message']);

        $this->match([['type' => 'inGroup', 'groupId' => Uuid::v7()->toRfc4122()]]);
        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function aQuickPickIsStoredOnTheMessageAsItsOneConditionAndGoesOnlyToThoseItMatches(): void
    {
        $sent = $this->send([['type' => 'notReplied']]);
        self::assertSame(202, $this->statusCode(), Json\encode($sent));

        $row = $this->messagesList()[0];
        self::assertSame('conditions', $row['audience']);
        self::assertSame([['type' => 'notReplied']], $row['conditions']);
        self::assertSame(1, $row['deliveries']);
        self::assertSame([$this->guests['Bayo']], $this->recipients(Type\string()->coerce($sent['id'])));

        $this->send([['type' => 'coming']]);
        self::assertSame([['type' => 'coming']], $this->messagesList()[0]['conditions']);
    }

    #[Test]
    public function aRenamedGroupShowsItsNewNameAndADeletedOneIsNamedAndMatchesNobodyInASavedAudienceToo(): void
    {
        $condition = ['type' => 'inGroup', 'groupId' => $this->family];
        $this->save('Family', [$condition]);

        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/guest-groups/' . $this->family, ['name' => 'Close family']);
        self::assertSame(200, $this->statusCode());
        self::assertSame(['name' => 'Close family', 'deleted' => false], $this->savedList()[0]['conditions'][0]['group']);

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/guest-groups/' . $this->family);
        self::assertSame(204, $this->statusCode());
        self::assertSame(['name' => 'Close family', 'deleted' => true], $this->savedList()[0]['conditions'][0]['group']);
        self::assertSame(['name' => 'Close family', 'deleted' => true], $this->match([$condition])['conditions'][0]['group']);
        self::assertSame(0, $this->match([$condition])['count']);
        $this->send([$condition]);
        self::assertSame(['nobody_matches'], $this->codes());

        $this->group('Close family');
        self::assertSame(0, $this->match([$condition])['count']);
    }

    #[Test]
    public function aScheduledAudienceIsWorkedOutWhenItGoesAndMayMatchNobodyThen(): void
    {
        $stored = Audience::fromArray(Json\decode(Json\encode(GuestAudienceResolver::audience(Uuid::fromString($this->eventId), GuestMessage::CONDITIONS, [], [['type' => 'notReplied']])->toArray())));
        $resolver = self::service(GuestAudienceResolver::class);

        self::assertSame([$this->guests['Bayo']], Vec\map($resolver->resolve($stored, null, 50), static fn (Uuid $id): string => $id->toRfc4122()));

        $this->db()->executeStatement('UPDATE guests SET invited_at = NOW() WHERE id = :id', ['id' => $this->guests['Ebun']]);
        self::assertCount(2, $resolver->resolve($stored, null, 50));

        $this->db()->executeStatement("UPDATE guests SET reply = 'coming', replied_at = NOW() WHERE event_id = :event", ['event' => $this->eventId]);
        self::assertSame([], $resolver->resolve($stored, null, 50));
    }

    #[Test]
    public function aSavedAudienceStoresConditionsNotPeopleAndMatchesWhoeverFitsLater(): void
    {
        $saved = $this->save('Not replied', [['type' => 'notReplied']]);
        self::assertSame(201, $this->statusCode(), Json\encode($saved));

        $stored = Type\string()->coerce($this->db()->fetchOne('SELECT conditions FROM saved_audiences'));
        self::assertSame([['type' => 'notReplied']], Json\decode($stored));
        self::assertStringNotContainsString($this->guests['Bayo'], $stored);

        $this->guest('Femi', invited: true, reply: null, email: true, mobile: false);
        self::assertSame(['Bayo', 'Femi'], $this->names($this->match($this->savedList()[0]['conditions'])));
    }

    #[Test]
    public function anAudienceThatMatchesNobodyCanBeSaved(): void
    {
        $this->save('Family, no reply', [['type' => 'inGroup', 'groupId' => $this->family], ['type' => 'notReplied']]);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aNameIsRequiredAtMost60AndUnusedIgnoringCaseAndAccents(): void
    {
        $this->save('   ', [['type' => 'coming']]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['audience_name_required'], $this->codes());

        $this->save(Str\repeat('a', 61), [['type' => 'coming']]);
        self::assertSame(422, $this->statusCode());
        self::assertSame(['audience_name_too_long'], $this->codes());

        $this->save('Élodie’s friends', [['type' => 'coming']]);
        self::assertSame(201, $this->statusCode());
        $taken = $this->save("elodie's FRIENDS", [['type' => 'notComing']]);
        self::assertSame(409, $this->statusCode());
        self::assertSame('There’s already a saved audience called Élodie’s friends.', $taken['detail']);
        self::assertCount(1, $this->savedList());
    }

    #[Test]
    public function aRenameHasTheSameChecksAndOneChangingOnlyCaseOrAccentsIsSaved(): void
    {
        $id = Type\string()->coerce($this->save('family', [['type' => 'coming']])['audience']['id'] ?? null);
        $this->save('Work', [['type' => 'coming']]);

        $this->rename($id, 'Fámily');
        self::assertSame(200, $this->statusCode());
        $this->rename($id, 'WORK');
        self::assertSame(409, $this->statusCode());
        $this->rename($id, '');
        self::assertSame(422, $this->statusCode());
        self::assertSame(['Fámily', 'Work'], Vec\map($this->savedList(), static fn (array $audience): mixed => $audience['name']));
    }

    #[Test]
    public function anEventKeepsAtMost20SavedAudiencesListedAToZ(): void
    {
        foreach (Vec\range(1, 20) as $n) {
            $this->save(Str\format('Audience %02d', 21 - $n), [['type' => 'coming']]);
            self::assertSame(201, $this->statusCode());
        }

        $full = $this->save('One too many', [['type' => 'coming']]);
        self::assertSame(409, $this->statusCode());
        self::assertSame('This event has 20 saved audiences, the most it can have. Delete one to save another.', $full['detail']);
        self::assertSame('Audience 01', $this->savedList()[0]['name']);
        self::assertCount(20, $this->savedList());
    }

    #[Test]
    public function aMessageKeepsItsOwnCopySoDeletingOrRenamingTheSavedAudienceChangesNoMessage(): void
    {
        $conditions = [['type' => 'hasEmail'], ['type' => 'invited']];
        $id = Type\string()->coerce($this->save('Invited, with email', $conditions)['audience']['id'] ?? null);
        $this->send([...$conditions, ['type' => 'notReplied']]);

        self::assertSame($conditions, $this->savedList()[0]['conditions']);

        $this->rename($id, 'Renamed');
        $this->as($this->owner, 'DELETE', $this->messages() . '/audiences/' . $id);
        self::assertSame(204, $this->statusCode());
        self::assertSame([...$conditions, ['type' => 'notReplied']], $this->messagesList()[0]['conditions']);
        self::assertSame([], $this->savedList());
    }

    #[Test]
    public function itIsForThoseWhoManageMessagesAndAnotherOrganisationsEventIsNotFound(): void
    {
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);
        $id = Type\string()->coerce($this->save('Coming', [['type' => 'coming']])['audience']['id'] ?? null);

        foreach ([['POST', '/audience', ['conditions' => [['type' => 'coming']]]], ['GET', '/audiences', null], ['POST', '/audiences', ['name' => 'Mine', 'conditions' => [['type' => 'coming']]]], ['PATCH', '/audiences/' . $id, ['name' => 'Mine']], ['DELETE', '/audiences/' . $id, null]] as [$method, $path, $body]) {
            $this->as($viewer, $method, $this->messages() . $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->as($stranger, 'POST', $this->messages() . '/audience', ['conditions' => [['type' => 'coming']]]);
        self::assertSame(404, $this->statusCode());
        $this->as($stranger, 'GET', $this->messages() . '/audiences');
        self::assertSame(404, $this->statusCode());
    }

    /** @return array<string, mixed> */
    private function match(mixed $conditions): array
    {
        return $this->as($this->owner, 'POST', $this->messages() . '/audience', ['conditions' => $conditions]);
    }

    /** @return array<string, mixed> */
    private function send(mixed $conditions): array
    {
        return $this->as($this->owner, 'POST', $this->messages(), ['audience' => 'conditions', 'conditions' => $conditions, 'message' => 'Please reply']);
    }

    /** @return array<string, mixed> */
    private function save(string $name, mixed $conditions): array
    {
        return $this->as($this->owner, 'POST', $this->messages() . '/audiences', ['name' => $name, 'conditions' => $conditions]);
    }

    /** @return array<string, mixed> */
    private function rename(string $id, string $name): array
    {
        return $this->as($this->owner, 'PATCH', $this->messages() . '/audiences/' . $id, ['name' => $name]);
    }

    /** @return list<array<string, mixed>> */
    private function savedList(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->messages() . '/audiences')['audiences'] ?? null);
    }

    /** @return list<array<string, mixed>> */
    private function messagesList(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->messages())['messages'] ?? null);
    }

    /** @return list<string> */
    private function recipients(string $messageId): array
    {
        return Type\vec(Type\string())->coerce($this->db()->fetchFirstColumn('SELECT recipient_id FROM notification_deliveries WHERE source_id = :id', ['id' => $messageId]));
    }

    /** @return list<string> */
    private function names(mixed $match): array
    {
        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce(Type\shape(['guests' => Type\mixed()], true)->coerce($match)['guests']), static fn (array $guest): string => $guest['name']);
    }

    /** @return list<string> */
    private function codes(): array
    {
        return Vec\map(Type\vec(Type\shape(['code' => Type\string()], true))->coerce($this->last()['violations'] ?? []), static fn (array $violation): string => $violation['code']);
    }

    private function messageCount(): int
    {
        return (int) $this->db()->fetchOne('SELECT COUNT(*) FROM guest_messages');
    }

    private function group(string $name): string
    {
        $made = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guest-groups', ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($made));

        return Type\shape(['id' => Type\string()], true)->coerce($made['group'] ?? null)['id'];
    }

    private function guest(string $name, bool $invited, ?string $reply, bool $email, bool $mobile, ?string $group = null, ?string $companion = null): void
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'email' => $email ? Str\lowercase($name) . '@example.test' : null,
            'companions' => null === $companion ? [] : [['fullName' => $companion]],
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
        $this->db()->executeStatement(
            'UPDATE guests SET invited_at = CASE WHEN :invited THEN NOW() END, reply = :reply, replied_at = CASE WHEN CAST(:reply AS VARCHAR) IS NULL THEN NULL ELSE NOW() END, mobile = :mobile, group_id = CAST(:group AS UUID) WHERE id = :id OR host_id = :id',
            ['invited' => $invited, 'reply' => $reply, 'mobile' => $mobile ? '+2348012345678' : null, 'group' => $group, 'id' => $id],
            ['invited' => 'boolean'],
        );
        self::em()->clear();
        $this->guests[$name] = $id;
    }

    private function messages(): string
    {
        return '/api/events/' . $this->eventId . '/messages';
    }

    private function db(): Connection
    {
        return self::service(Connection::class);
    }

    private function live(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        $this->db()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
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

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /** @return array<string, mixed> */
    private function as(User $user, string $method, string $path, mixed $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
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
