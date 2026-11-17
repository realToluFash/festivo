<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Realtime\SubscriberTokenIssuer;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;

/** Who else has an event's seating plan open, and what each of its editors has chosen (sc-4719). */
final class SeatingPresenceTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events', 'Ngozi Eze');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function anEditorsTokenNamesThemAsAnEditorAndCoversThePlanItsChoicesAndWhoIsHere(): void
    {
        $claims = $this->mercureClaims($this->owner);

        self::assertSame([
            'subscribe' => [
                'events/' . $this->eventId . '/seating',
                'events/' . $this->eventId . '/seating/choices',
                '/.well-known/mercure/subscriptions/events%2F' . $this->eventId . '%2Fseating{/subscriber}',
            ],
            'payload' => ['userId' => $this->owner->getId()->toRfc4122(), 'name' => 'Ngozi Eze', 'editor' => true],
        ], $claims);
    }

    #[Test]
    public function aViewerShowsAsHereButNotAsAnEditor(): void
    {
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $claims = $this->mercureClaims($viewer);

        self::assertSame(['userId' => $viewer->getId()->toRfc4122(), 'name' => 'Ada Obi', 'editor' => false], $claims['payload'] ?? null);
    }

    #[Test]
    public function noEmailAddressIsInAnyTokenOrChoice(): void
    {
        $planner = $this->member('kemi@ire.events', 'Kemi Adeyemi', EventRole::CanEdit);
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);
        $table = $this->addTable();

        $tokens = [$this->token($this->owner), $this->token($planner), $this->token($viewer)];
        $this->as($planner, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $table, 'chair' => 2]]);

        foreach ([...$tokens, ...$this->publishedChoices()] as $sent) {
            self::assertFalse(Str\contains($sent, '@'), $sent);
        }
    }

    #[Test]
    public function aTokenLastsTenMinutesSoSomeoneWhoLosesThePlanStopsReceivingItWithinThem(): void
    {
        $token = new Parser(new JoseEncoder())->parse($this->token($this->owner));
        self::assertInstanceOf(UnencryptedToken::class, $token);

        $issued = Type\instance_of(DateTimeImmutable::class)->coerce($token->claims()->get('iat'));
        $expires = Type\instance_of(DateTimeImmutable::class)->coerce($token->claims()->get('exp'));

        self::assertSame(600, SubscriberTokenIssuer::SEATING_LIFETIME_SECONDS);
        self::assertSame(600, $expires->getTimestamp() - $issued->getTimestamp());
    }

    #[Test]
    public function anEditorsChoiceIsToldToEveryoneWithThePlanOpen(): void
    {
        $table = $this->addTable();

        $this->as($this->owner, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $table]]);

        self::assertSame(204, $this->statusCode());
        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/seating/choices'], $update->getTopics());
        self::assertTrue($update->isPrivate());
        self::assertSame(
            ['userId' => $this->owner->getId()->toRfc4122(), 'chosen' => ['kind' => 'table', 'id' => $table, 'chair' => null]],
            Json\decode($update->getData()),
        );
    }

    #[Test]
    public function oneOfATablesChairsIsToldAsThatChair(): void
    {
        $table = $this->addTable();

        $this->as($this->owner, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $table, 'chair' => 1]]);

        self::assertSame(204, $this->statusCode());
        self::assertSame(['kind' => 'table', 'id' => $table, 'chair' => 1], $this->lastChoice()['chosen']);
    }

    #[Test]
    public function clearingAChoiceIsToldAsNothingChosen(): void
    {
        $this->as($this->owner, 'PUT', $this->chosen(), ['chosen' => null]);

        self::assertSame(204, $this->statusCode());
        self::assertSame(['userId' => $this->owner->getId()->toRfc4122(), 'chosen' => null], $this->lastChoice());
    }

    #[Test]
    public function aViewersChoiceIsNeverShared(): void
    {
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);
        $table = $this->addTable();
        $before = Iter\count(self::service(RecordingHub::class)->published);

        $this->as($viewer, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $table]]);

        self::assertSame(403, $this->statusCode());
        self::assertCount($before, self::service(RecordingHub::class)->published);
    }

    #[Test]
    public function somebodyWhoCannotOpenThePlanIsGivenNoTokenAndCannotChoose(): void
    {
        $outsider = $this->member('tunde@ire.events', 'Tunde Bello', null);
        $stranger = $this->account('stranger@else.where', 'Someone Else');
        $table = $this->addTable();

        foreach ([$outsider, $stranger] as $who) {
            $this->as($who, 'POST', $this->plan() . '/subscriptions');
            self::assertContains($this->statusCode(), [403, 404]);
            $this->as($who, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $table]]);
            self::assertContains($this->statusCode(), [403, 404]);
        }
    }

    #[Test]
    public function anItemFromAnotherPlanOrNoneAtAllIsNotFound(): void
    {
        $host = $this->account('host@party.us', 'Host');
        $theirs = self::service(OrganisationFounder::class)->found($host, 'Party Co', 'US', 'America/New_York');
        self::em()->flush();
        $theirEvent = $this->newEvent($host, $theirs);
        $this->as($host, 'POST', '/api/events/' . $theirEvent . '/seating-plan', ['widthCm' => 2400, 'lengthCm' => 1800]);
        $theirTable = Type\string()->coerce($this->as($host, 'POST', '/api/events/' . $theirEvent . '/seating-plan/tables', ['shape' => 'round'])['tableId'] ?? null);

        foreach ([$theirTable, 'not-an-id'] as $id) {
            $this->as($this->owner, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $id]]);
            self::assertSame(404, $this->statusCode(), $id);
        }
    }

    #[Test]
    public function aChairPastTheTablesSeatsIsNotFound(): void
    {
        $table = $this->addTable();
        $before = Iter\count(self::service(RecordingHub::class)->published);

        foreach ([0, 99] as $chair) {
            $this->as($this->owner, 'PUT', $this->chosen(), ['chosen' => ['kind' => 'table', 'id' => $table, 'chair' => $chair]]);
            self::assertSame(404, $this->statusCode(), (string) $chair);
        }

        self::assertCount($before, self::service(RecordingHub::class)->published);
    }

    #[Test]
    public function anEditorAndAViewerEachSayTheyAreStillHere(): void
    {
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        foreach ([$this->owner, $viewer] as $who) {
            $this->as($who, 'POST', $this->plan() . '/here');

            self::assertSame(204, $this->statusCode());
            $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
            self::assertSame(['events/' . $this->eventId . '/seating/choices'], $update->getTopics());
            self::assertTrue($update->isPrivate());
            self::assertSame(['userId' => $who->getId()->toRfc4122(), 'here' => true], Json\decode($update->getData()));
            self::assertFalse(Str\contains($update->getData(), '@'));
        }
    }

    #[Test]
    public function somebodyWhoCannotOpenThePlanCannotSayTheyAreHere(): void
    {
        $outsider = $this->member('tunde@ire.events', 'Tunde Bello', null);
        $stranger = $this->account('stranger@else.where', 'Someone Else');
        $revoked = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);
        $this->as($revoked, 'POST', $this->plan() . '/here');
        self::assertSame(204, $this->statusCode());
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $revoked->getId()]) ?? self::fail('not a member');
        $role = self::em()->getRepository(EventPerson::class)->findOneBy(['event' => $this->eventId, 'membership' => $membership]) ?? self::fail('no role on the event');
        self::em()->remove($role);
        self::em()->flush();
        $before = Iter\count(self::service(RecordingHub::class)->published);

        foreach (['outsider' => $outsider, 'stranger' => $stranger, 'revoked' => $revoked] as $who => $user) {
            $this->as($user, 'POST', $this->plan() . '/here');
            self::assertSame(404, $this->statusCode(), $who);
        }

        self::assertCount($before, self::service(RecordingHub::class)->published);
    }

    /** @return non-empty-string */
    private function token(User $as): string
    {
        $body = $this->as($as, 'POST', $this->plan() . '/subscriptions');
        self::assertSame(200, $this->statusCode());

        return Type\non_empty_string()->coerce($body['token'] ?? null);
    }

    /** @return array<string, mixed> */
    private function mercureClaims(User $as): array
    {
        $token = new Parser(new JoseEncoder())->parse($this->token($as));
        self::assertInstanceOf(UnencryptedToken::class, $token);

        return Type\dict(Type\string(), Type\mixed())->coerce($token->claims()->get('mercure'));
    }

    /** @return list<string> */
    private function publishedChoices(): array
    {
        $choices = [];
        foreach (self::service(RecordingHub::class)->published as $update) {
            if (['events/' . $this->eventId . '/seating/choices'] === $update->getTopics()) {
                $choices[] = $update->getData();
            }
        }

        self::assertNotSame([], $choices);

        return $choices;
    }

    /** @return array<string, mixed> */
    private function lastChoice(): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode(Iter\last($this->publishedChoices()) ?? self::fail('nothing chosen')));
    }

    private function addTable(): string
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round']);
        self::assertSame(201, $this->statusCode());

        return Type\string()->coerce($body['tableId'] ?? null);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
    }

    private function newEvent(?User $by = null, ?Organisation $organisation = null): string
    {
        $body = $this->as($by ?? $this->owner, 'POST', '/api/orgs/' . ($organisation ?? $this->organisation)->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function chosen(): string
    {
        return $this->plan() . '/chosen';
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));

        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
