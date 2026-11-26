<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\StaffRoster;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\NeedKind;
use App\Enum\SectionColour;
use App\Enum\StationKind;
use App\Locale\NameNormaliser;
use App\Repository\EmailAddressRepository;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** sc-4005 with sc-4002: who may make each step, and whose names each caller is given. */
final class ServiceAccessTest extends ServiceTestCase
{
    private const string NOTE = 'Seat away from the groom’s mother';

    private User $bisi;

    private User $kemi;

    private User $tunde;

    private User $reader;

    private SeatingTable $tableB;

    private SeatingTable $tableC;

    private StaffMember $kemiOnB;

    private StaffStation $stationC;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bisi = $this->verified('bisi@lagoslights.example', 'Bisi Waiter');
        $this->kemi = $this->verified('kemi@lagoslights.example', 'Kemi Waiter');
        $this->tunde = $this->verified('tunde@lagoslights.example', 'Tunde Disher');
        $this->reader = $this->verified('ola@lagoslights.example', 'Ola Reader');

        $sectionB = new SeatingSection($this->plan, 'Section B', NameNormaliser::key('Section B'), SectionColour::Blue, null);
        $sectionC = new SeatingSection($this->plan, 'Section C', NameNormaliser::key('Section C'), SectionColour::Blue, null);
        self::em()->persist($sectionB);
        self::em()->persist($sectionC);
        $this->tableB = $this->tableIn($sectionB, 'Table 2');
        $this->tableC = $this->tableIn($sectionC, 'Table 3');
        $this->seat('Funmi Bello', $this->tableB, 1);

        foreach (['Gbenga Okoro', 'Halima Musa', 'Ifeanyi Uche', 'Jide Cole'] as $seat => $name) {
            $this->seat($name, $this->tableC, $seat + 1);
        }

        $this->onSection($this->bisi, 'bisi@lagoslights.example', $this->stationOf($this->section, 0));
        $this->kemiOnB = $this->onSection($this->kemi, 'kemi@lagoslights.example', $this->stationOf($sectionB, 1));
        $this->stationC = $this->stationOf($sectionC, 2);
        self::em()->flush();

        $owner = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        self::service(GuestNeedsRecord::class)->write($this->guests['Adaeze Obi'], new GuestNeeds([NeedKind::Allergen->value => ['peanuts'], NeedKind::Access->value => ['step_free']], [NeedKind::Access->value => 'A ramp at the side door'], self::NOTE), $owner);
        self::em()->flush();

        foreach (['bisi' => 'can_work_floor', 'kemi' => 'can_work_floor', 'tunde' => 'can_work_pass', 'ola' => 'can_view'] as $who => $level) {
            $this->as('POST', '/api/events/' . $this->event->getId()->toRfc4122() . '/people', ['address' => $who . '@lagoslights.example', 'role' => $level]);
            self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        }

        $this->arrive('Adaeze Obi', 'Bola Ade', 'Funmi Bello', 'Gbenga Okoro', 'Halima Musa', 'Ifeanyi Uche', 'Jide Cole');
        $this->fire();
        $this->fire(null, $this->tableB);
        $this->fire(null, $this->tableC);
    }

    #[Test]
    public function namesGoToTheSectionsPeopleAndToWhoeverMayWriteAtATableNobodyIsOn(): void
    {
        $seen = [
            'owner' => [$this->owner, ['Table 1' => true, 'Table 2' => true, 'Table 3' => true]],
            'Bisi, on Section A' => [$this->bisi, ['Table 1' => true, 'Table 2' => false, 'Table 3' => true]],
            'Kemi, on Section B' => [$this->kemi, ['Table 1' => false, 'Table 2' => true, 'Table 3' => true]],
            'Tunde, at the Pass' => [$this->tunde, ['Table 1' => false, 'Table 2' => false, 'Table 3' => false]],
        ];

        foreach ($seen as $who => [$caller, $named]) {
            $this->caller = $caller;
            $read = $this->read();

            self::assertSame($named, $this->namedTables($read), $who);
            self::assertSame(['peanuts'], Type\mixed_dict()->coerce($this->guestOf(self::tableOf($read, $this->tableKey()), 'Adaeze Obi')['flags'])['allergens'], $who . ' gets the flags');
            $this->assertNoPrivateNeeds($read, $who);
        }
    }

    #[Test]
    public function aCallerWithoutTheServiceIsRefused(): void
    {
        $this->caller = $this->reader;

        $this->as('GET', '/api/events/' . $this->event->getId()->toRfc4122() . '/service/course/' . $this->courseId());
        $this->assertRefused(403, ErrorCode::PermissionRequired->type());
        $this->post('/course/' . $this->courseId() . '/trays', ['table' => $this->tableKey()]);
        $this->assertRefused(403, ErrorCode::PermissionRequired->type());
    }

    #[Test]
    public function floorOpensOnTheFloorWithTheSectionsYouAreOnAndIsRefusedAtThePassAlone(): void
    {
        $kemi = self::em()->find(StaffMember::class, $this->kemiOnB->getId()) ?? self::fail('no Kemi');
        $kemi->setFloorLead(true);
        self::em()->flush();
        $path = '/api/events/' . $this->event->getId()->toRfc4122() . '/service/floor';

        $this->caller = $this->bisi;
        $floor = $this->as('GET', $path);
        self::assertSame(200, $this->statusCode(), Json\encode($floor));
        self::assertSame([['id' => $this->section->getId()->toRfc4122(), 'name' => 'Section A']], $floor['yours']);
        self::assertSame('Kemi Waiter', $floor['floorLead']);
        self::assertFalse($floor['manage']);
        $read = Type\mixed_dict()->coerce(Type\vec(Type\mixed_dict())->coerce($floor['courses'])[0]);
        self::assertSame(['Table 1' => true, 'Table 2' => false, 'Table 3' => true], $this->namedTables($read), 'each course read as Bisi sees it');
        $this->assertNoPrivateNeeds($read, 'Floor');

        $this->caller = $this->owner;
        $floor = $this->as('GET', $path);
        self::assertSame([], $floor['yours']);
        self::assertTrue($floor['manage']);

        foreach ([$this->tunde, $this->reader] as $refused) {
            $this->caller = $refused;
            $this->as('GET', $path);
            $this->assertRefused(403, ErrorCode::PermissionRequired->type());
        }
    }

    #[Test]
    public function tableWritesAreRefusedAtAnotherSectionsTable(): void
    {
        $this->caller = $this->bisi;
        $funmi = Type\string()->coerce(Type\mixed_dict()->coerce($this->guestOf(self::tableOf($this->asOwner($this->read(...)), self::keyOf($this->tableB)), 'Funmi Bello')['order'])['id']);

        $this->post('/course/' . $this->courseId() . '/trays', ['table' => self::keyOf($this->tableB)]);
        $this->assertRefused(403, ErrorCode::TableNotYours->type());
        $this->put('/plates/' . $funmi . '/choice', ['choice' => 'waitForAll']);
        $this->assertRefused(403, ErrorCode::TableNotYours->type());

        $this->caller = $this->kemi;
        $tray = $this->startTray(self::keyOf($this->tableB));
        $this->toTheTable($tray);
        $this->post('/trays/' . Type\string()->coerce($tray['id']) . '/all-served');

        $this->caller = $this->bisi;
        $this->post('/plates/' . $funmi . '/sent-back', ['reason' => 'dropped']);
        $this->assertRefused(403, ErrorCode::TableNotYours->type());
        self::assertSame('served', $this->asOwner(fn (): mixed => $this->orderAt(self::keyOf($this->tableB), 'Funmi Bello')['stage']));
    }

    #[Test]
    public function marksAnItemAtThePassAndOnlyThere(): void
    {
        $this->caller = $this->tunde;
        $this->itemState('plantain', 'preparing', 5);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->post('/course/' . $this->courseId() . '/trays', ['table' => $this->tableKey()]);
        $this->assertRefused(403, ErrorCode::PermissionRequired->type());

        $this->caller = $this->bisi;
        $this->itemState('plantain', 'ready');
        $this->assertRefused(403, ErrorCode::PermissionRequired->type());
    }

    #[Test]
    public function aStartedTrayIsItsWaitersAfterTheSectionChangesHandsAndNobodyElses(): void
    {
        $this->caller = $this->bisi;
        $tray = $this->startTray(self::keyOf($this->tableC));
        $trayPath = '/trays/' . Type\string()->coerce($tray['id']);
        [$gbenga] = Type\vec(Type\string())->coerce($tray['plates']);

        $kemi = self::em()->find(StaffMember::class, $this->kemiOnB->getId()) ?? self::fail('no Kemi');
        $kemi->setStation(self::em()->find(StaffStation::class, $this->stationC->getId()) ?? self::fail('no station'));
        self::em()->flush();

        $this->post('/course/' . $this->courseId() . '/trays', ['table' => self::keyOf($this->tableC)]);
        $this->assertRefused(403, ErrorCode::TableNotYours->type());
        self::assertSame(['Gbenga Okoro' => true, 'Halima Musa' => true, 'Ifeanyi Uche' => true, 'Jide Cole' => false], $this->namesAt(self::keyOf($this->tableC)), 'Bisi keeps the names of the plates she carries');

        $this->caller = $this->kemi;
        $this->post($trayPath . '/check');
        $this->assertRefused(403, ErrorCode::TrayNotYours->type());
        self::assertSame(['id' => $this->bisi->getId()->toRfc4122(), 'name' => 'Bisi Waiter'], $this->last()['waiter']);
        self::assertStringContainsString('Bisi Waiter', Type\string()->coerce($this->last()['detail'] ?? $this->last()['title'] ?? ''));

        foreach (['mark' => fn () => $this->put($trayPath . '/marks', ['plateId' => $gbenga, 'item' => 'plantain', 'mark' => 'on']), 'take off' => fn () => $this->takeOff(Type\string()->coerce($tray['id']), $gbenga), 'take to the table' => fn () => $this->post($trayPath . '/take-to-table'), 'all served' => fn () => $this->post($trayPath . '/all-served')] as $step => $refused) {
            $refused();
            self::assertSame(ErrorCode::TrayNotYours->type(), $this->last()['type'] ?? null, $step);
        }

        $this->caller = $this->bisi;
        $this->toTheTable($tray);
        $this->post($trayPath . '/plates/' . $gbenga . '/served');
        self::assertSame(200, $this->statusCode(), 'no table_not_yours once the tray is hers: ' . Json\encode($this->last()));
        $this->post($trayPath . '/all-served');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->caller = $this->owner;
        $this->post('/undo', ['subject' => Type\string()->coerce($tray['id'])]);
        self::assertSame(204, $this->statusCode(), 'running the service undoes anyone’s step: ' . Json\encode($this->last()));
    }

    #[Test]
    public function onlyWhoeverMadeAStepUndoesItWithoutRunningTheService(): void
    {
        $this->caller = $this->bisi;
        $tray = $this->startTray();

        $this->caller = $this->kemi;
        $this->post('/undo', ['subject' => Type\string()->coerce($tray['id'])]);
        $this->assertRefused(403, ErrorCode::PermissionRequired->type());

        $this->caller = $this->bisi;
        $this->post('/undo', ['subject' => Type\string()->coerce($tray['id'])]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
    }

    /** @param array<array-key, mixed> $read */
    private function namedTables(array $read): array
    {
        return Dict\from_entries(Vec\map(
            Type\vec(Type\mixed_dict())->coerce($read['tables']),
            static fn (array $table): array => [Type\string()->coerce($table['name']), [] !== Vec\filter_nulls(Vec\map(Type\vec(Type\mixed_dict())->coerce($table['guests']), static fn (array $guest): mixed => $guest['name']))],
        ));
    }

    /** @return array<string, bool> */
    private function namesAt(string $tableKey): array
    {
        $guests = Type\vec(Type\mixed_dict())->coerce(self::tableOf($this->read(), $tableKey)['guests']);
        $ids = Dict\flip(Dict\map($this->guests, static fn ($guest): string => $guest->getId()->toRfc4122()));

        return Dict\from_entries(Vec\map($guests, static fn (array $guest): array => [$ids[Type\string()->coerce($guest['id'])], null !== $guest['name']]));
    }

    /** @param array<array-key, mixed> $read */
    private function assertNoPrivateNeeds(array $read, string $who): void
    {
        $body = Json\encode($read);

        foreach ([self::NOTE, 'A ramp at the side door', 'step_free'] as $private) {
            self::assertFalse(Str\contains($body, $private), $who . ' was given ' . $private);
        }
    }

    /** @return array<array-key, mixed> */
    private function orderAt(string $tableKey, string $name): array
    {
        return Type\mixed_dict()->coerce($this->guestOf(self::tableOf($this->read(), $tableKey), $name)['order']);
    }

    /**
     * @template T
     *
     * @param callable(): T $read
     *
     * @return T
     */
    private function asOwner(callable $read): mixed
    {
        $caller = $this->caller;
        $this->caller = $this->owner;

        try {
            return $read();
        } finally {
            $this->caller = $caller;
        }
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

    private function stationOf(SeatingSection $section, int $position): StaffStation
    {
        $station = new StaffStation($this->event, StationKind::Section, $section->getName(), NameNormaliser::key($section->getName()), $section, $position);
        self::em()->persist($station);

        return $station;
    }

    private function onSection(User $user, string $address, StaffStation $station): StaffMember
    {
        $entry = self::service(StaffRoster::class)->add($this->event, new StaffDetails($user->getName(), null, $address), null, null, $this->owner, allowShared: true);
        $entry->setStation($station);

        return $entry;
    }
}
