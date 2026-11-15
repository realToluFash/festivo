<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Audit\Auditor;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MeasurementSystem;
use App\Enum\RealtimeTopic;
use App\Enum\SectionColour;
use App\Enum\TableShape;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Realtime\RealtimePublisher;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingRowRepository;
use App\Repository\SeatingSeatRepository;
use App\Repository\SeatingSectionRepository;
use App\Repository\SeatingTableRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Each change runs under a lock on the plan's row, so two saves sent together queue and the second sees the first (sc-3998). */
final readonly class SeatingPlanEditor
{
    public const string STARTED = 'seating.plan_started';

    public const string CHANGED = 'seating.plan_changed';

    public const string DELETED = 'seating.plan_deleted';

    public const string SECTION_ADDED = 'seating.section_added';

    public const string SECTION_CHANGED = 'seating.section_changed';

    public const string SECTION_DELETED = 'seating.section_deleted';

    public const string TABLE_ADDED = 'seating.table_added';

    public const string TABLE_CHANGED = 'seating.table_changed';

    public const string TABLE_DELETED = 'seating.table_deleted';

    public const string ROW_ADDED = 'seating.row_added';

    public const string ROW_CHANGED = 'seating.row_changed';

    public const string ROW_DELETED = 'seating.row_deleted';

    public const string SEAT_ADDED = 'seating.seat_added';

    public const string SEAT_CHANGED = 'seating.seat_changed';

    public const string SEAT_DELETED = 'seating.seat_deleted';

    public function __construct(
        private SeatingRules $seatingRules,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatingRowRepository $seatingRowRepository,
        private SeatingSeatRepository $seatingSeatRepository,
        private SeatingSerialiser $seatingSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
        private TranslatorInterface $translator,
    ) {
    }

    public function start(Event $event, User $by, ?string $roomName, ?int $widthCm, ?int $lengthCm): SeatingPlan
    {
        $room = $this->seatingRules->room($roomName, $widthCm, $lengthCm, self::systemOf($event));

        $plan = $this->entityManager->wrapInTransaction(function () use ($event, $by, $room): SeatingPlan {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (null !== $this->seatingPlanRepository->findOneForEvent($event)) {
                throw new ApiException(ErrorCode::SeatingPlanExists, 'seating.plan_exists');
            }

            $plan = new SeatingPlan($event, $room['roomName'], $room['widthCm'], $room['lengthCm'], $by);
            $this->entityManager->persist($plan);
            $this->auditor->record(self::STARTED, 'SeatingPlan', $plan->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::recorded($plan)));
            $this->entityManager->flush();

            return $plan;
        });

        $this->published($event, $plan);

        return $plan;
    }

    /** @param array{roomName?: ?string, widthCm?: int, lengthCm?: int} $fields a field left out keeps its value */
    public function change(Event $event, SeatingPlan $plan, ?string $ifMatch, User $by, array $fields): SeatingPlan
    {
        $ifMatch = self::versionRequired($ifMatch);

        $this->locked($plan, function () use ($event, $plan, $ifMatch, $by, $fields): void {
            if (!EntityTag::matches($ifMatch, EntityTag::of($plan->getVersion()))) {
                throw self::changedSince($plan->getChangedBy());
            }

            $room = $this->seatingRules->room(
                Iter\contains_key($fields, 'roomName') ? $fields['roomName'] : $plan->getRoomName(),
                $fields['widthCm'] ?? $plan->getWidthCm(),
                $fields['lengthCm'] ?? $plan->getLengthCm(),
                self::systemOf($event),
            );
            $this->refuseShrinkingPast($plan, $room['widthCm'], $room['lengthCm'], self::systemOf($event));

            $before = self::recorded($plan);
            $plan->setRoomName($room['roomName']);
            $plan->setWidthCm($room['widthCm']);
            $plan->setLengthCm($room['lengthCm']);
            $changes = Auditor::diff($before, self::recorded($plan));

            if ([] !== $changes) {
                $plan->setChangedBy($by);
                $this->auditor->record(self::CHANGED, 'SeatingPlan', $plan->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan);

        return $plan;
    }

    public function delete(Event $event, SeatingPlan $plan, User $by): void
    {
        $this->locked($plan, function () use ($plan, $by): void {
            $this->auditor->record(self::DELETED, 'SeatingPlan', $plan->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::recorded($plan), []));

            foreach ($this->furniture($plan) as $item) {
                $this->entityManager->remove($item);
            }

            foreach ($this->seatingSectionRepository->findInPlan($plan) as $section) {
                $this->entityManager->remove($section);
            }

            $this->entityManager->remove($plan);
        });

        $this->published($event, null);
    }

    /** With no colour chosen, the least used (sc-3998, 21 Oct). */
    public function addSection(Event $event, SeatingPlan $plan, User $by, string $name, ?SectionColour $colour): SeatingSection
    {
        $section = $this->locked($plan, function () use ($plan, $by, $name, $colour): SeatingSection {
            $sections = $this->seatingSectionRepository->findInPlan($plan);

            if (Iter\count($sections) >= SeatingPlan::SECTIONS_MAXIMUM) {
                throw new ApiException(ErrorCode::SeatingSectionLimit, 'seating.section_limit');
            }

            $named = $this->seatingRules->sectionName($name, $sections);
            $chosen = $colour ?? SectionColourPicker::leastUsed(Vec\map($sections, static fn (SeatingSection $other): SectionColour => $other->getColour()));
            $section = new SeatingSection($plan, $named['name'], $named['nameKey'], $chosen, $by);
            $this->entityManager->persist($section);
            $this->auditor->record(self::SECTION_ADDED, 'SeatingSection', $section->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::sectionRecorded($section)));

            return $section;
        });

        $this->published($event, $plan);

        return $section;
    }

    /** @param array{name?: string, colour?: SectionColour} $fields */
    public function changeSection(Event $event, SeatingSection $section, ?string $ifMatch, User $by, array $fields): SeatingSection
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $section->getPlan();

        $this->locked($plan, function () use ($section, $plan, $ifMatch, $by, $fields): void {
            $this->entityManager->refresh($section);

            if (!EntityTag::matches($ifMatch, EntityTag::of($section->getVersion()))) {
                throw self::changedSince($section->getChangedBy());
            }

            $before = self::sectionRecorded($section);

            if (Iter\contains_key($fields, 'name')) {
                $others = Vec\filter($this->seatingSectionRepository->findInPlan($plan), static fn (SeatingSection $other): bool => !$other->getId()->equals($section->getId()));
                $named = $this->seatingRules->sectionName($fields['name'], $others);
                $section->setName($named['name']);
                $section->setNameKey($named['nameKey']);
            }

            if (Iter\contains_key($fields, 'colour')) {
                $section->setColour($fields['colour']);
            }

            $changes = Auditor::diff($before, self::sectionRecorded($section));

            if ([] !== $changes) {
                $section->setChangedBy($by);
                $this->auditor->record(self::SECTION_CHANGED, 'SeatingSection', $section->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan);

        return $section;
    }

    /** Tables, rows and seats it labelled keep their places with no section (sc-3998); it never deletes furniture. */
    public function deleteSection(Event $event, SeatingSection $section, User $by): void
    {
        $plan = $section->getPlan();

        $this->locked($plan, function () use ($plan, $section, $by): void {
            foreach ($this->furniture($plan) as $item) {
                if (true === $item->getSection()?->getId()->equals($section->getId())) {
                    $item->setSection(null);
                }
            }

            $this->auditor->record(self::SECTION_DELETED, 'SeatingSection', $section->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::sectionRecorded($section), []));
            $this->entityManager->remove($section);
        });

        $this->published($event, $plan);
    }

    /** Named "Table {n}" in the creator's language with the next free number, at the room's centre or the nearest free floor to it. */
    public function addTable(Event $event, SeatingPlan $plan, User $by, TableShape $shape): SeatingTable
    {
        $table = $this->locked($plan, function () use ($plan, $by, $shape): SeatingTable {
            $tables = $this->seatingTableRepository->findInPlan($plan);
            $table = $this->newTable($plan, $tables, $shape, Math\div($plan->getWidthCm(), 2), Math\div($plan->getLengthCm(), 2), $by);
            $this->auditor->record(self::TABLE_ADDED, 'SeatingTable', $table->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::tableRecorded($table)));

            return $table;
        });

        $this->published($event, $plan);

        return $table;
    }

    /** @param array{name?: string, sectionId?: ?string, shape?: TableShape, seats?: int, widthCm?: int, lengthCm?: int, endSeats?: int, rotation?: int, unusableSeats?: list<int>} $fields a field left out keeps its value; a new shape takes its default size, no ends and no turn */
    public function changeTable(Event $event, SeatingTable $table, ?string $ifMatch, User $by, array $fields): SeatingTable
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $table->getPlan();

        $this->locked($plan, function () use ($event, $table, $plan, $ifMatch, $by, $fields): void {
            $this->entityManager->refresh($table);
            $this->unchangedSince($table, $ifMatch);
            $before = self::tableRecorded($table);

            if (Iter\contains_key($fields, 'name')) {
                $others = Vec\filter($this->seatingTableRepository->findInPlan($plan), static fn (SeatingTable $other): bool => !$other->getId()->equals($table->getId()));
                $named = $this->seatingRules->tableName($fields['name'], $others);
                $table->rename($named['name'], $named['nameKey']);
            }

            if (Iter\contains_key($fields, 'sectionId')) {
                $table->setSection($this->sectionIn($plan, $fields['sectionId']));
            }

            $shape = $fields['shape'] ?? $table->getShape();
            $reshaped = $shape !== $table->getShape();
            $defaults = $shape->defaults();
            $seats = $fields['seats'] ?? $table->getSeats();
            $widthCm = $fields['widthCm'] ?? ($reshaped ? $defaults['widthCm'] : $table->getWidthCm());
            $lengthCm = $shape->isRound() ? $widthCm : ($fields['lengthCm'] ?? ($reshaped ? $defaults['lengthCm'] : $table->getLengthCm()));
            $endSeats = $fields['endSeats'] ?? ($reshaped ? 0 : Math\minva($table->getEndSeats(), $seats));
            $rotation = $fields['rotation'] ?? ($reshaped ? 0 : $table->getRotation());
            $unusable = $fields['unusableSeats'] ?? Vec\filter($table->getUnusableSeats(), static fn (int $seat): bool => $seat <= $seats);
            $this->seatingRules->tableLayout($shape, $seats, $widthCm, $lengthCm, $endSeats, $rotation, $unusable, self::systemOf($event));
            $table->lay($shape, $seats, $widthCm, $lengthCm, $endSeats, $rotation, Vec\sort($unusable));

            $changes = Auditor::diff($before, self::tableRecorded($table));

            if ([] !== $changes) {
                $table->setChangedBy($by);
                $this->auditor->record(self::TABLE_CHANGED, 'SeatingTable', $table->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan);

        return $table;
    }

    /** Shape, size, seats, ends, turn, section and unusable chairs, with nobody seated, below and to the right of the original. */
    public function duplicateTable(Event $event, SeatingTable $original, ?string $ifMatch, User $by): SeatingTable
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $original->getPlan();

        $copy = $this->locked($plan, function () use ($original, $plan, $ifMatch, $by): SeatingTable {
            $this->entityManager->refresh($original);
            $this->unchangedSince($original, $ifMatch);
            $tables = $this->seatingTableRepository->findInPlan($plan);
            $copy = $this->newTable(
                $plan,
                $tables,
                $original->getShape(),
                $original->getXCm() + FloorGeometry::COPY_OFFSET_CM[0],
                $original->getYCm() + FloorGeometry::COPY_OFFSET_CM[1],
                $by,
                $original,
            );
            $this->auditor->record(self::TABLE_ADDED, 'SeatingTable', $copy->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::tableRecorded($copy)));

            return $copy;
        });

        $this->published($event, $plan);

        return $copy;
    }

    public function deleteTable(Event $event, SeatingTable $table, ?string $ifMatch, User $by): void
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $table->getPlan();

        $this->locked($plan, function () use ($table, $ifMatch, $by): void {
            $this->entityManager->refresh($table);
            $this->unchangedSince($table, $ifMatch);
            $this->auditor->record(self::TABLE_DELETED, 'SeatingTable', $table->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::tableRecorded($table), []));
            $this->entityManager->remove($table);
        });

        $this->published($event, $plan);
    }

    /** Ten seats labelled with the next free letter, at the room's centre or the nearest free floor to it. */
    public function addRow(Event $event, SeatingPlan $plan, User $by): SeatingRow
    {
        $row = $this->locked($plan, function () use ($plan, $by): SeatingRow {
            $row = $this->newRow($plan, Math\div($plan->getWidthCm(), 2), Math\div($plan->getLengthCm(), 2), $by);
            $this->auditor->record(self::ROW_ADDED, 'SeatingRow', $row->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::rowRecorded($row)));

            return $row;
        });

        $this->published($event, $plan);

        return $row;
    }

    /** @param array{label?: string, sectionId?: ?string, seats?: int, spacingCm?: int, rotation?: int, unusableSeats?: list<int>} $fields a field left out keeps its value; fewer seats drop from the right-hand end, and their unusable marks with them */
    public function changeRow(Event $event, SeatingRow $row, ?string $ifMatch, User $by, array $fields): SeatingRow
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $row->getPlan();

        $this->locked($plan, function () use ($event, $row, $plan, $ifMatch, $by, $fields): void {
            $this->entityManager->refresh($row);
            $this->unchangedSince($row, $ifMatch);
            $before = self::rowRecorded($row);

            if (Iter\contains_key($fields, 'label')) {
                $others = Vec\filter($this->seatingRowRepository->findInPlan($plan), static fn (SeatingRow $other): bool => !$other->getId()->equals($row->getId()));
                $labelled = $this->seatingRules->rowLabel($fields['label'], $others);
                $row->relabel($labelled['label'], $labelled['labelKey']);
            }

            if (Iter\contains_key($fields, 'sectionId')) {
                $row->setSection($this->sectionIn($plan, $fields['sectionId']));
            }

            $seats = $fields['seats'] ?? $row->getSeats();
            $spacingCm = $fields['spacingCm'] ?? $row->getSpacingCm();
            $rotation = $fields['rotation'] ?? $row->getRotation();
            $unusable = $fields['unusableSeats'] ?? Vec\filter($row->getUnusableSeats(), static fn (int $seat): bool => $seat <= $seats);
            $this->seatingRules->rowLayout($seats, $spacingCm, $rotation, $unusable, self::systemOf($event));
            $row->lay($seats, $spacingCm, $rotation, Vec\sort($unusable));

            $changes = Auditor::diff($before, self::rowRecorded($row));

            if ([] !== $changes) {
                $row->setChangedBy($by);
                $this->auditor->record(self::ROW_CHANGED, 'SeatingRow', $row->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan);

        return $row;
    }

    /** Seats, spacing, turn, section and unusable seats, with the next free label and nobody seated, below the original. */
    public function duplicateRow(Event $event, SeatingRow $original, ?string $ifMatch, User $by): SeatingRow
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $original->getPlan();

        $copy = $this->locked($plan, function () use ($original, $plan, $ifMatch, $by): SeatingRow {
            $this->entityManager->refresh($original);
            $this->unchangedSince($original, $ifMatch);
            $copy = $this->newRow($plan, $original->getXCm() + FloorGeometry::COPY_OFFSET_CM[0], $original->getYCm() + FloorGeometry::COPY_OFFSET_CM[1], $by, $original);
            $this->auditor->record(self::ROW_ADDED, 'SeatingRow', $copy->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::rowRecorded($copy)));

            return $copy;
        });

        $this->published($event, $plan);

        return $copy;
    }

    public function deleteRow(Event $event, SeatingRow $row, ?string $ifMatch, User $by): void
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $row->getPlan();

        $this->locked($plan, function () use ($row, $ifMatch, $by): void {
            $this->entityManager->refresh($row);
            $this->unchangedSince($row, $ifMatch);
            $this->auditor->record(self::ROW_DELETED, 'SeatingRow', $row->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::rowRecorded($row), []));
            $this->entityManager->remove($row);
        });

        $this->published($event, $plan);
    }

    /** Named "Seat {n}" in the creator's language with the next free number, at the room's centre or the nearest free floor to it. */
    public function addSeat(Event $event, SeatingPlan $plan, User $by): SeatingSeat
    {
        $seat = $this->locked($plan, function () use ($plan, $by): SeatingSeat {
            $named = $this->nextSeatName($this->seatingSeatRepository->findInPlan($plan));
            $seat = new SeatingSeat($plan, $named['name'], $named['nameKey'], Math\div($plan->getWidthCm(), 2), Math\div($plan->getLengthCm(), 2), $by);
            [$x, $y] = FloorGeometry::nearestFree($seat, $this->furniture($plan), $plan, $seat->getXCm(), $seat->getYCm());
            $seat->moveTo($x, $y);
            $this->entityManager->persist($seat);
            $this->auditor->record(self::SEAT_ADDED, 'SeatingSeat', $seat->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::seatRecorded($seat)));

            return $seat;
        });

        $this->published($event, $plan);

        return $seat;
    }

    /** @param array{name?: string, sectionId?: ?string, unusable?: bool} $fields a field left out keeps its value */
    public function changeSeat(Event $event, SeatingSeat $seat, ?string $ifMatch, User $by, array $fields): SeatingSeat
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $seat->getPlan();

        $this->locked($plan, function () use ($seat, $plan, $ifMatch, $by, $fields): void {
            $this->entityManager->refresh($seat);
            $this->unchangedSince($seat, $ifMatch);
            $before = self::seatRecorded($seat);

            if (Iter\contains_key($fields, 'name')) {
                $others = Vec\filter($this->seatingSeatRepository->findInPlan($plan), static fn (SeatingSeat $other): bool => !$other->getId()->equals($seat->getId()));
                $named = $this->seatingRules->seatName($fields['name'], $others);
                $seat->rename($named['name'], $named['nameKey']);
            }

            if (Iter\contains_key($fields, 'sectionId')) {
                $seat->setSection($this->sectionIn($plan, $fields['sectionId']));
            }

            if (Iter\contains_key($fields, 'unusable')) {
                $seat->setUnusable($fields['unusable']);
            }

            $changes = Auditor::diff($before, self::seatRecorded($seat));

            if ([] !== $changes) {
                $seat->setChangedBy($by);
                $this->auditor->record(self::SEAT_CHANGED, 'SeatingSeat', $seat->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan);

        return $seat;
    }

    public function deleteSeat(Event $event, SeatingSeat $seat, ?string $ifMatch, User $by): void
    {
        $ifMatch = self::versionRequired($ifMatch);
        $plan = $seat->getPlan();

        $this->locked($plan, function () use ($seat, $ifMatch, $by): void {
            $this->entityManager->refresh($seat);
            $this->unchangedSince($seat, $ifMatch);
            $this->auditor->record(self::SEAT_DELETED, 'SeatingSeat', $seat->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::seatRecorded($seat), []));
            $this->entityManager->remove($seat);
        });

        $this->published($event, $plan);
    }

    /** @return list<SeatingTable|SeatingRow|SeatingSeat> everything standing in the room */
    private function furniture(SeatingPlan $plan): array
    {
        return Vec\concat($this->seatingTableRepository->findInPlan($plan), $this->seatingRowRepository->findInPlan($plan), $this->seatingSeatRepository->findInPlan($plan));
    }

    private function newRow(SeatingPlan $plan, int $xCm, int $yCm, User $by, ?SeatingRow $copying = null): SeatingRow
    {
        $label = self::nextRowLabel(Vec\map($this->seatingRowRepository->findInPlan($plan), static fn (SeatingRow $row): string => $row->getLabelKey()));
        $row = new SeatingRow($plan, $label, NameNormaliser::key($label), $xCm, $yCm, $by);

        if (null !== $copying) {
            $row->setSection($copying->getSection());
            $row->lay($copying->getSeats(), $copying->getSpacingCm(), $copying->getRotation(), $copying->getUnusableSeats());
        }

        [$x, $y] = FloorGeometry::nearestFree($row, $this->furniture($plan), $plan, $xCm, $yCm);
        $row->moveTo($x, $y);
        $this->entityManager->persist($row);

        return $row;
    }

    /** @param list<string> $taken the plan's label keys */
    public static function nextRowLabel(array $taken): string
    {
        $n = 1;

        while (Iter\contains($taken, NameNormaliser::key(self::rowLabelAt($n)))) {
            ++$n;
        }

        return self::rowLabelAt($n);
    }

    /** 1 is A, 26 is Z, 27 is AA, 53 is BA. */
    public static function rowLabelAt(int $n): string
    {
        $label = '';

        for ($left = $n; $left > 0; $left = Math\div($left - 1, 26)) {
            $label = Str\chr(65 + ($left - 1) % 26) . $label;
        }

        return $label;
    }

    /**
     * @param list<SeatingSeat> $seats
     *
     * @return array{name: string, nameKey: string}
     */
    private function nextSeatName(array $seats): array
    {
        $taken = Vec\map($seats, static fn (SeatingSeat $seat): string => $seat->getNameKey());

        $n = 1;

        while (Iter\contains($taken, NameNormaliser::key($this->translator->trans('seating.seat_default_name', ['{n}' => $n])))) {
            ++$n;
        }

        $name = $this->translator->trans('seating.seat_default_name', ['{n}' => $n]);

        return ['name' => $name, 'nameKey' => NameNormaliser::key($name)];
    }

    /** @param list<SeatingTable> $tables the plan's tables before this one */
    private function newTable(SeatingPlan $plan, array $tables, TableShape $shape, int $xCm, int $yCm, User $by, ?SeatingTable $copying = null): SeatingTable
    {
        $named = $this->nextTableName($tables);
        $table = new SeatingTable($plan, $named['name'], $named['nameKey'], $shape, $xCm, $yCm, $by);

        if (null !== $copying) {
            $table->setSection($copying->getSection());
            $table->lay($shape, $copying->getSeats(), $copying->getWidthCm(), $copying->getLengthCm(), $copying->getEndSeats(), $copying->getRotation(), $copying->getUnusableSeats());
        }

        [$x, $y] = FloorGeometry::nearestFree($table, $this->furniture($plan), $plan, $xCm, $yCm);
        $table->moveTo($x, $y);
        $this->entityManager->persist($table);

        return $table;
    }

    /**
     * @param list<SeatingTable> $tables
     *
     * @return array{name: string, nameKey: string}
     */
    private function nextTableName(array $tables): array
    {
        $taken = Vec\map($tables, static fn (SeatingTable $table): string => $table->getNameKey());

        $n = 1;

        while (Iter\contains($taken, NameNormaliser::key($this->defaultTableName($n)))) {
            ++$n;
        }

        $name = $this->defaultTableName($n);

        return ['name' => $name, 'nameKey' => NameNormaliser::key($name)];
    }

    private function defaultTableName(int $n): string
    {
        return $this->translator->trans('seating.table_default_name', ['{n}' => $n]);
    }

    private function sectionIn(SeatingPlan $plan, ?string $sectionId): ?SeatingSection
    {
        if (null === $sectionId) {
            return null;
        }

        if (!Uuid::isValid($sectionId)) {
            throw $this->seatingRules->unknownSection();
        }

        $section = $this->seatingSectionRepository->find(Uuid::fromString($sectionId));

        return null !== $section && $section->getPlan()->getId()->equals($plan->getId()) ? $section : throw $this->seatingRules->unknownSection();
    }

    private function unchangedSince(SeatingTable|SeatingRow|SeatingSeat $item, string $ifMatch): void
    {
        if (!EntityTag::matches($ifMatch, EntityTag::of($item->getVersion()))) {
            throw self::changedSince($item->getChangedBy());
        }
    }

    /** A room may not shrink past anything in it, chairs included, nor further past an item already through that wall (sc-4000, 409: the size is valid, the furniture is in the way); each table, row and single seat counts once (sc-4003). */
    private function refuseShrinkingPast(SeatingPlan $plan, int $widthCm, int $lengthCm, MeasurementSystem $system): void
    {
        $outside = Vec\filter(
            $this->furniture($plan),
            static fn (SeatingTable|SeatingRow|SeatingSeat $item): bool => FloorGeometry::cutByShrinking($item, $plan->getWidthCm(), $plan->getLengthCm(), $widthCm, $lengthCm),
        );

        if ([] === $outside) {
            return;
        }

        $locale = $this->translator->getLocale();

        throw new ApiException(
            ErrorCode::SeatingItemsOutside,
            'seating.items_outside',
            members: ['outside' => Vec\map($outside, static fn (SeatingTable|SeatingRow|SeatingSeat $item): string => $item->getId()->toRfc4122())],
            parameters: ['{count}' => Iter\count($outside), '{width}' => $system->written($widthCm, $locale), '{roomLength}' => $system->written($lengthCm, $locale)],
        );
    }

    public static function systemOf(Event $event): MeasurementSystem
    {
        return MeasurementSystem::forTerritory($event->getOrganisation()->getCountryCode());
    }

    /**
     * @template T
     *
     * @param callable(): T $change
     *
     * @return T
     */
    private function locked(SeatingPlan $plan, callable $change): mixed
    {
        return $this->entityManager->wrapInTransaction(function () use ($plan, $change): mixed {
            $this->entityManager->refresh($plan, LockMode::PESSIMISTIC_WRITE);
            $changed = $change();
            $this->entityManager->flush();

            return $changed;
        });
    }

    private static function versionRequired(?string $ifMatch): string
    {
        if (null === $ifMatch || '*' === Str\trim($ifMatch)) {
            throw new ApiException(ErrorCode::PreconditionRequired, 'seating.version_required');
        }

        return $ifMatch;
    }

    private static function changedSince(?User $changedBy): ApiException
    {
        $name = $changedBy?->getName();

        return new ApiException(ErrorCode::PreconditionFailed, 'seating.changed_since', members: null === $name ? [] : ['changedBy' => $name]);
    }

    private function published(Event $event, ?SeatingPlan $plan): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $event->getId()->toRfc4122(), $this->seatingSerialiser->seating($event, $plan));
    }

    /** @return array<string, mixed> */
    private static function recorded(SeatingPlan $plan): array
    {
        return ['roomName' => $plan->getRoomName(), 'widthCm' => $plan->getWidthCm(), 'lengthCm' => $plan->getLengthCm()];
    }

    /** @return array<string, mixed> */
    private static function tableRecorded(SeatingTable $table): array
    {
        return [
            'name' => $table->getName(),
            'section' => $table->getSection()?->getId()->toRfc4122(),
            'shape' => $table->getShape()->value,
            'seats' => $table->getSeats(),
            'widthCm' => $table->getWidthCm(),
            'lengthCm' => $table->getLengthCm(),
            'endSeats' => $table->getEndSeats(),
            'rotation' => $table->getRotation(),
            'xCm' => $table->getXCm(),
            'yCm' => $table->getYCm(),
            'unusableSeats' => $table->getUnusableSeats(),
        ];
    }

    /** @return array<string, mixed> */
    private static function rowRecorded(SeatingRow $row): array
    {
        return [
            'label' => $row->getLabel(),
            'section' => $row->getSection()?->getId()->toRfc4122(),
            'seats' => $row->getSeats(),
            'spacingCm' => $row->getSpacingCm(),
            'rotation' => $row->getRotation(),
            'xCm' => $row->getXCm(),
            'yCm' => $row->getYCm(),
            'unusableSeats' => $row->getUnusableSeats(),
        ];
    }

    /** @return array<string, mixed> */
    private static function seatRecorded(SeatingSeat $seat): array
    {
        return [
            'name' => $seat->getName(),
            'section' => $seat->getSection()?->getId()->toRfc4122(),
            'xCm' => $seat->getXCm(),
            'yCm' => $seat->getYCm(),
            'unusable' => $seat->isUnusable(),
        ];
    }

    /** @return array<string, mixed> */
    private static function sectionRecorded(SeatingSection $section): array
    {
        return ['name' => $section->getName(), 'colour' => $section->getColour()->value];
    }
}
