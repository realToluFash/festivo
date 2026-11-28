<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\StaffRoster;
use App\Entity\MenuCourse;
use App\Entity\StaffItemStation;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\RealtimeTopic;
use App\Enum\StationKind;
use App\Locale\NameNormaliser;
use App\Repository\EmailAddressRepository;
use App\Repository\StaffMemberRepository;
use App\Tests\Double\Messaging\RecordingHub;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** The kitchen stations a station's screen lists (sc-4015), and the times it reads off the service: when a mark was made, and when an item first went Preparing. */
final class KitchenStationsTest extends ServiceTestCase
{
    private StaffStation $grill;

    private StaffStation $cold;

    protected function setUp(): void
    {
        parent::setUp();
        $this->grill = $this->place('Grill', 0, 2);
        $this->cold = $this->place('Cold room', 1, 1);
        $this->place('Bar', 2, 3);
        self::em()->persist(new StaffItemStation($this->course, 'jollof rice', $this->grill));
        self::em()->persist(new StaffItemStation($this->course, 'plantain', $this->cold));
        self::em()->flush();
    }

    #[Test]
    public function listsThePassThenEachPlaceThatDishesAnItemInTheWalkingOrderWithWhoIsOnIt(): void
    {
        $tunde = $this->verified('tunde@lagoslights.example', 'Tunde Disher');
        $this->onStation('Tunde Disher', 'tunde@lagoslights.example', $this->grill);
        $this->onStation('Kemi Cook', 'kemi@lagoslights.example', $this->grill);
        $this->invite('tunde@lagoslights.example', 'can_work_pass');

        $this->caller = $tunde;
        $list = $this->stations();

        self::assertSame(['Pass', 'Cold room', 'Grill'], Vec\map($list['stations'], static fn (array $one): mixed => $one['name']), 'the Bar dishes nothing');
        self::assertSame([[], [], [['Tunde Disher', true], ['Kemi Cook', false]]], Vec\map($list['stations'], static fn (array $one): array => Vec\map(Type\vec(Type\shape(['name' => Type\string(), 'you' => Type\bool()], true))->coerce($one['people']), static fn (array $person): array => [$person['name'], $person['you']])), 'the viewer is matched by the roster, not by name');
        self::assertSame($this->grill->getId()->toRfc4122(), $list['yours']);
        self::assertSame([], $list['fired'], 'nothing fired yet');
        self::assertSame([$this->event->getName(), 'Tunde Disher'], [$list['event'], $list['you']], 'working the pass reads no event, so the list names it');

        $this->caller = $this->owner;
        $owner = $this->stations();
        self::assertNull($owner['yours'], 'the owner is on no station');
        self::assertSame($this->owner->getName(), $owner['you'], 'off the roster, the account\'s name');
    }

    #[Test]
    public function aChangeToWhoIsOnAStationIsToldOnTheServiceTopic(): void
    {
        $this->onStation('Tunde Disher', 'tunde@lagoslights.example', $this->grill);
        $tunde = self::service(StaffMemberRepository::class)->findOnStation($this->grill)[0];
        $hub = self::service(RecordingHub::class);
        $hub->published = [];

        $this->caller = $this->owner;
        $this->as('PUT', '/api/events/' . $this->event->getId()->toRfc4122() . '/stations/people/' . $tunde->getId()->toRfc4122(), ['station' => $this->cold->getId()->toRfc4122()]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $update = $hub->lastOn(RealtimeTopic::EventService->for($this->event->getId()->toRfc4122())) ?? self::fail('nothing told on the service topic');
        self::assertSame(['type' => 'stations'], Json\decode($update->getData()));
    }

    #[Test]
    public function namesEachFiredCourseInTheMenusOrderWithWhenItWasFirstFired(): void
    {
        $starter = new MenuCourse($this->event, 'Starter', null, -1);
        $starter->listOwnItems(['Small chops']);
        self::em()->persist($starter);
        self::em()->flush();
        $this->arrive('Adaeze Obi');
        $this->fire();
        self::mockTime(new DateTimeImmutable('2027-03-06T19:30:00Z'));
        $this->fire($starter);

        self::assertSame([
            ['id' => $this->courseId($starter), 'name' => 'Starter', 'firedAt' => '2027-03-06T19:30:00.000+00:00'],
            ['id' => $this->courseId(), 'name' => 'Main', 'firedAt' => '2027-03-06T19:00:00.000+00:00'],
        ], $this->stations()['fired']);
    }

    #[Test]
    public function isRefusedToWhoeverWorksOnlyTheFloorAndToWhoeverHasNoService(): void
    {
        $bisi = $this->verified('bisi@lagoslights.example', 'Bisi Waiter');
        $ola = $this->verified('ola@lagoslights.example', 'Ola Reader');
        $this->invite('bisi@lagoslights.example', 'can_work_floor');
        $this->invite('ola@lagoslights.example', 'can_view');

        foreach (['floor' => $bisi, 'none' => $ola] as $works => $caller) {
            $this->caller = $caller;
            $this->as('GET', $this->path());
            $this->assertRefused(403, ErrorCode::PermissionRequired->type());
            self::assertSame('floor' === $works ? 'floor' : null, $this->last()['worksAt'] ?? null, 'the refusal says where the floor\'s level does work');
        }
    }

    #[Test]
    public function aMarkCarriesWhenItWasMadeAndLosesItWhenCleared(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $tray = $this->startTray();
        $plate = Type\string()->coerce(Type\vec(Type\string())->coerce($tray['plates'])[0]);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:04:00Z'));

        $this->put('/trays/' . Type\string()->coerce($tray['id']) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'on']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('2027-03-06T19:04:00.000+00:00', $this->markOn($tray, 'plantain')['at']);

        $this->put('/trays/' . Type\string()->coerce($tray['id']) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => null]);
        $cleared = $this->markOn($tray, 'plantain');
        self::assertSame([null, null], [$cleared['mark'], $cleared['at']]);
    }

    #[Test]
    public function preparingKeepsWhenItFirstWentPreparingThroughANewTimeAndReadyClearsIt(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $this->itemState('plantain', 'preparing', 5);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:06:00Z'));
        $this->itemState('plantain', 'preparing', 10);

        $item = $this->item('plantain');
        self::assertSame(['preparing', 10, '2027-03-06T19:06:00.000+00:00', '2027-03-06T19:00:00.000+00:00'], [$item['state'], $item['readyIn'], $item['changedAt'], $item['preparingSince']]);

        self::assertSame($this->itemId('plantain'), $item['id'], 'an item marked once has an id to undo it by');
        $this->post('/undo', ['subject' => $this->itemId('plantain')]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([5, '2027-03-06T19:00:00.000+00:00'], [$this->item('plantain')['readyIn'], $this->item('plantain')['preparingSince']], 'undo puts the first time back');

        $this->itemState('plantain', 'ready');
        self::assertNull($this->item('plantain')['preparingSince']);
    }

    /** @return array{event: string, you: string, stations: list<array<array-key, mixed>>, yours: ?string, fired: list<mixed>} */
    private function stations(): array
    {
        $body = $this->as('GET', $this->path());
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\shape(['event' => Type\string(), 'you' => Type\string(), 'stations' => Type\vec(Type\mixed_dict()), 'yours' => Type\nullable(Type\string()), 'fired' => Type\vec(Type\mixed())])->coerce($body);
    }

    private function path(): string
    {
        return '/api/events/' . $this->event->getId()->toRfc4122() . '/service/stations';
    }

    /**
     * @param array<array-key, mixed> $tray
     *
     * @return array<array-key, mixed>
     */
    private function markOn(array $tray, string $item): array
    {
        $read = self::trayOf($this->read(), Type\string()->coerce($tray['id']));

        foreach (Type\vec(Type\mixed_dict())->coerce($read['stops']) as $stop) {
            foreach (Type\vec(Type\mixed_dict())->coerce($stop['marks']) as $mark) {
                if ($mark['item'] === $item) {
                    return $mark;
                }
            }
        }

        self::fail('no mark for ' . $item);
    }

    /** @return array<array-key, mixed> */
    private function item(string $key): array
    {
        foreach (Type\vec(Type\mixed_dict())->coerce($this->read()['items']) as $item) {
            if ($item['key'] === $key) {
                return $item;
            }
        }

        self::fail('no item ' . $key);
    }

    private function itemId(string $key): string
    {
        return Type\string()->coerce($this->db()->fetchOne('SELECT id FROM service_items WHERE course_id = :course AND item_key = :item', ['course' => $this->courseId(), 'item' => $key]));
    }

    private function place(string $name, int $position, int $walk): StaffStation
    {
        $place = new StaffStation($this->event, StationKind::Place, $name, NameNormaliser::key($name), null, $position);
        $place->setWalkPosition($walk);
        self::em()->persist($place);

        return $place;
    }

    private function onStation(string $name, string $address, StaffStation $station): void
    {
        $entry = self::service(StaffRoster::class)->add($this->event, new StaffDetails($name, null, $address), null, null, $this->owner, allowShared: true);
        $entry->setStation($station);
        self::em()->flush();
    }

    private function invite(string $address, string $level): void
    {
        $caller = $this->caller;
        $this->caller = $this->owner;
        $this->as('POST', '/api/events/' . $this->event->getId()->toRfc4122() . '/people', ['address' => $address, 'role' => $level]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->caller = $caller;
    }

    private function verified(string $address, string $name): User
    {
        $user = $this->account($address, $name);

        foreach (self::service(EmailAddressRepository::class)->findBy(['user' => $user]) as $email) {
            $email->setVerifiedAt($email->getVerifiedAt() ?? new DateTimeImmutable());
        }

        self::em()->flush();

        return $user;
    }
}
