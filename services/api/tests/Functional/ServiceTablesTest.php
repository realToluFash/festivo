<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Staff\Station\ServiceTables;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\SectionColour;
use App\Enum\StationKind;
use App\Enum\TableShape;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** sc-4002: working the floor reaches the tables of your own section and of a section nobody is on; running it reaches every table. */
final class ServiceTablesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private User $waiter;

    private User $other;

    private SeatingTable $theirs;

    private SeatingTable $yours;

    private SeatingTable $nobodys;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->waiter = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->other = $this->account('kemi@lagoslights.example', 'Kemi');

        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-07T02:00']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $event = self::em()->find(Event::class, Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id']) ?? self::fail('no event');
        $plan = new SeatingPlan($event, null, 2000, 2000, null);
        self::em()->persist($plan);

        $this->yours = $this->table($event, $plan, 'Section A', $this->waiter);
        $this->theirs = $this->table($event, $plan, 'Section B', $this->other);
        $this->nobodys = $this->table($event, $plan, 'Section C', null);
        self::em()->flush();
    }

    #[Test]
    public function workingTheFloorReachesYourSectionAndOneNobodyIsOnButNotSomebodyElses(): void
    {
        $grants = Grants::fromOutside(EventRole::CanWorkFloor);

        $this->assertReaches($grants, $this->waiter, $this->yours, null);
        $this->assertReaches($grants, $this->waiter, $this->nobodys, null);
        $this->assertReaches($grants, $this->waiter, $this->theirs, ErrorCode::TableNotYours);
    }

    #[Test]
    public function runningTheFloorReachesEveryTable(): void
    {
        foreach ([Grants::fromOutside(EventRole::CanRunFloor), Grants::onEvent(EventRole::CanEdit), Grants::onEvent(EventRole::Lead), Grants::everything()] as $grants) {
            $this->assertReaches($grants, $this->waiter, $this->theirs, null);
        }
    }

    #[Test]
    public function thePassAndTheReadingRolesReachNoTable(): void
    {
        foreach ([Grants::fromOutside(EventRole::CanWorkPass), Grants::onEvent(EventRole::CanView), Grants::fromOutside(EventRole::CanCheckIn)] as $grants) {
            $this->assertReaches($grants, $this->waiter, $this->nobodys, ErrorCode::PermissionRequired);
        }
    }

    private function assertReaches(Grants $grants, User $user, SeatingTable $table, ?ErrorCode $refusal): void
    {
        try {
            (new ServiceTables(self::service(StaffStationRepository::class), self::service(StaffMemberRepository::class)))->requireYours($grants, $user, $table);
            self::assertNull($refusal, $table->getName() . ' should be refused');
        } catch (ApiException $refused) {
            self::assertSame($refusal, $refused->errorCode, $table->getName());
            self::assertSame(403, $refused->getCode());
        }
    }

    private function table(Event $event, SeatingPlan $plan, string $name, ?User $on): SeatingTable
    {
        $section = new SeatingSection($plan, $name, NameNormaliser::key($name), SectionColour::Blue, null);
        self::em()->persist($section);
        $station = new StaffStation($event, StationKind::Section, $name, NameNormaliser::key($name), $section, 0);
        self::em()->persist($station);

        if (null !== $on) {
            $member = new StaffMember($event, $on->getName(), null, null, $on);
            $member->setStation($station);
            self::em()->persist($member);
        }

        $table = new SeatingTable($plan, $name . ' T1', NameNormaliser::key($name . ' T1'), TableShape::Round, 100, 100, null);
        $table->setSection($section);
        self::em()->persist($table);

        return $table;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
