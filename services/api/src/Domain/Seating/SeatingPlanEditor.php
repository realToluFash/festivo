<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Audit\Auditor;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Domain\Seating\Numbers\SeatingNumbersPublisher;
use App\Entity\Event;
use App\Entity\SeatAssignment;
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
use App\Realtime\CheckInSignal;
use App\Realtime\RealtimePublisher;
use App\Repository\GuestRepository;
use App\Repository\SeatAssignmentRepository;
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
use Psl\Type;
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

    public const string ARRANGED = 'seating.arranged';

    public function __construct(
        private SeatingRules $seatingRules,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingTableRepository $seatingTableRepository,
        private SeatingRowRepository $seatingRowRepository,
        private SeatingSeatRepository $seatingSeatRepository,
        private SeatingSerialiser $seatingSerialiser,
        private SeatingNumbersPublisher $seatingNumbersPublisher,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
        private TranslatorInterface $translator,
        private SeatAssignmentRepository $seatAssignmentRepository,
        private GuestSeater $guestSeater,
        private GuestRepository $guestRepository,
        private GuestPageSignal $guestPageSignal,
        private CheckInSignal $checkInSignal,
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

        $this->published($event, $plan, false);

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

        $this->published($event, $plan, false);

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
            $endSeats = $fields['endSeats'] ?? ($reshaped ? 0 : Math\maxva(0, Math\minva($table->getEndSeats(), $seats)));
            $rotation = $fields['rotation'] ?? ($reshaped ? 0 : $table->getRotation());
            $unusable = $fields['unusableSeats'] ?? Vec\filter($table->getUnusableSeats(), static fn (int $seat): bool => $seat <= $seats);
            $this->seatingRules->tableLayout($shape, $seats, $widthCm, $lengthCm, $endSeats, $rotation, $unusable, self::systemOf($event));
            $this->keepTheSeated($table, $seats, $unusable);
            $table->lay($shape, $seats, $widthCm, $lengthCm, $endSeats, $rotation, Vec\sort($unusable));

            $changes = Auditor::diff($before, self::tableRecorded($table));

            if ([] !== $changes) {
                $table->setChangedBy($by);
                $this->auditor->record(self::TABLE_CHANGED, 'SeatingTable', $table->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan, Iter\contains_key($fields, 'name') || Iter\contains_key($fields, 'sectionId'));

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

        $this->published($event, $plan, false);

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
            $this->keepTheSeated($row, $seats, $unusable);
            $row->lay($seats, $spacingCm, $rotation, Vec\sort($unusable));

            $changes = Auditor::diff($before, self::rowRecorded($row));

            if ([] !== $changes) {
                $row->setChangedBy($by);
                $this->auditor->record(self::ROW_CHANGED, 'SeatingRow', $row->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan, Iter\contains_key($fields, 'label') || Iter\contains_key($fields, 'sectionId'));

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

        $this->published($event, $plan, false);

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
                $this->keepTheSeated($seat, 1, $fields['unusable'] ? [1] : []);
                $seat->setUnusable($fields['unusable']);
            }

            $changes = Auditor::diff($before, self::seatRecorded($seat));

            if ([] !== $changes) {
                $seat->setChangedBy($by);
                $this->auditor->record(self::SEAT_CHANGED, 'SeatingSeat', $seat->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event, $plan, Iter\contains_key($fields, 'name') || Iter\contains_key($fields, 'sectionId'));

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

    /**
     * One step of moves, turns and resizes, of one item or several, saved all or nothing (sc-5028): any item changed since its `version` refuses the whole step with 412 naming every stale item, and an item left outside the room refuses it beside that item.
     *
     * @param list<array{kind: 'table'|'row'|'seat', id: string, version: int, xCm: int, yCm: int, rotation?: int, widthCm?: int, lengthCm?: int}> $items
     */
    public function arrange(Event $event, SeatingPlan $plan, User $by, array $items): void
    {
        $this->somethingChosen($items);

        $this->locked($plan, function () use ($event, $plan, $by, $items): void {
            $found = $this->unchangedItems($plan, $items);
            $system = self::systemOf($event);
            $violations = [];

            foreach ($found as $index => $item) {
                $fields = $items[$index];
                $before = $this->recordedItem($item);

                try {
                    $this->reshape($item, $fields, $system);
                } catch (ApiException $refused) {
                    $violations = [...$violations, ...Vec\map($refused->violations, static fn (array $violation): array => [...$violation, 'propertyPath' => 'items[' . $index . '].' . $violation['propertyPath']])];

                    continue;
                }

                $item->moveTo($fields['xCm'], $fields['yCm']);

                if (!FloorGeometry::inside($item, $plan->getWidthCm(), $plan->getLengthCm())) {
                    $violations[] = $item instanceof SeatingRow
                        ? $this->seatingRules->arrangeViolation('items[' . $index . ']', 'validation.seating_row_outside_room', ['{label}' => $item->getLabel()])
                        : $this->seatingRules->arrangeViolation('items[' . $index . ']', 'validation.seating_outside_room', ['{name}' => $item->getName()]);

                    continue;
                }

                $changes = Auditor::diff($before, $this->recordedItem($item));

                if ([] !== $changes) {
                    $item->setChangedBy($by);
                    $this->auditor->record(self::ARRANGED, self::auditedAs($item), $item->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
                }
            }

            if ([] !== $violations) {
                throw ApiException::validation($violations);
            }
        });

        $this->published($event, $plan, false);
    }

    /** @param list<array{id: string, version: int, name: string}> $items */
    public function renameTables(Event $event, SeatingPlan $plan, User $by, array $items): void
    {
        $this->somethingChosen($items);

        $this->locked($plan, function () use ($plan, $by, $items): void {
            $tables = Type\vec(Type\instance_of(SeatingTable::class))->coerce($this->unchangedItems($plan, Vec\map($items, static fn (array $item): array => ['kind' => 'table', ...$item])));
            $ids = Vec\map($tables, static fn (SeatingTable $table): string => $table->getId()->toRfc4122());
            $others = Vec\filter($this->seatingTableRepository->findInPlan($plan), static fn (SeatingTable $table): bool => !Iter\contains($ids, $table->getId()->toRfc4122()));
            $named = [];
            $violations = [];

            foreach ($items as $index => $item) {
                try {
                    $one = $this->seatingRules->tableName($item['name'], []);
                } catch (ApiException $refused) {
                    $violations = [...$violations, ...self::under('items[' . $index . ']', $refused)];

                    continue;
                }

                $outside = Iter\search($others, static fn (SeatingTable $other): bool => $other->getNameKey() === $one['nameKey']);
                $twice = Iter\any($named, static fn (array $earlier): bool => $earlier['nameKey'] === $one['nameKey']);

                if (null !== $outside || $twice) {
                    $violations[] = $this->seatingRules->arrangeViolation('items[' . $index . '].name', null === $outside ? 'validation.seating_table_name_taken' : 'validation.seating_renumber_taken', ['{name}' => $outside?->getName() ?? $one['name']]);

                    continue;
                }

                $named[$index] = $one;
            }

            if ([] !== $violations) {
                throw ApiException::validation($violations);
            }

            $before = Vec\map($tables, self::tableRecorded(...));

            foreach ($tables as $table) {
                $table->rename($table->getName(), '#' . $table->getId()->toRfc4122());
            }

            $this->entityManager->flush();

            foreach ($tables as $index => $table) {
                $table->rename($named[$index]['name'], $named[$index]['nameKey']);
                $changes = Auditor::diff($before[$index], self::tableRecorded($table));

                if ([] !== $changes) {
                    $table->setChangedBy($by);
                    $this->auditor->record(self::TABLE_CHANGED, 'SeatingTable', $table->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
                }
            }
        });

        $this->published($event, $plan);
    }

    /** @param list<array{kind: 'table'|'row'|'seat', id: string, version: int, sectionId: ?string}> $items */
    public function sectionFurniture(Event $event, SeatingPlan $plan, User $by, array $items): void
    {
        $this->somethingChosen($items);

        $this->locked($plan, function () use ($plan, $by, $items): void {
            foreach ($this->unchangedItems($plan, $items) as $index => $item) {
                $before = $this->recordedItem($item);
                $item->setSection($this->sectionIn($plan, $items[$index]['sectionId']));
                $changes = Auditor::diff($before, $this->recordedItem($item));

                if ([] !== $changes) {
                    $item->setChangedBy($by);
                    $this->auditor->record(self::ARRANGED, self::auditedAs($item), $item->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
                }
            }
        });

        $this->published($event, $plan);
    }

    /** @param list<array{kind: 'table'|'row'|'seat', id: string, version: int}> $items */
    public function duplicateFurniture(Event $event, SeatingPlan $plan, User $by, array $items): array
    {
        $this->somethingChosen($items);

        $copies = $this->locked($plan, function () use ($plan, $by, $items): array {
            $tables = $this->seatingTableRepository->findInPlan($plan);
            $rows = $this->seatingRowRepository->findInPlan($plan);
            $seats = $this->seatingSeatRepository->findInPlan($plan);
            $copies = [];

            foreach (FloorGeometry::inReadingOrder($this->unchangedItems($plan, $items)) as $original) {
                $xCm = $original->getXCm() + FloorGeometry::GROUP_COPY_OFFSET_CM;
                $yCm = $original->getYCm() + FloorGeometry::GROUP_COPY_OFFSET_CM;

                if ($original instanceof SeatingTable) {
                    $copy = $this->tableCopy($plan, $tables, $original, $xCm, $yCm, $by);
                    $tables[] = $copy;
                } elseif ($original instanceof SeatingRow) {
                    $label = self::nextRowLabel(Vec\map($rows, static fn (SeatingRow $row): string => $row->getLabelKey()));
                    $copy = new SeatingRow($plan, $label, NameNormaliser::key($label), $xCm, $yCm, $by);
                    $copy->lay($original->getSeats(), $original->getSpacingCm(), $original->getRotation(), $original->getUnusableSeats());
                    $rows[] = $copy;
                } else {
                    $named = $this->nextSeatName($seats);
                    $copy = new SeatingSeat($plan, $named['name'], $named['nameKey'], $xCm, $yCm, $by);
                    $copy->setUnusable($original->isUnusable());
                    $seats[] = $copy;
                }

                if (!FloorGeometry::inside($copy, $plan->getWidthCm(), $plan->getLengthCm())) {
                    throw ApiException::validation([$this->seatingRules->arrangeViolation('items', 'validation.seating_copy_outside_room', ['{name}' => self::nameOf($original)])]);
                }

                $copy->setSection($original->getSection());
                $this->entityManager->persist($copy);
                $this->auditor->record(self::addedAs($copy), self::auditedAs($copy), $copy->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], $this->recordedItem($copy)));
                $copies[] = $copy;
            }

            return $copies;
        });

        $this->published($event, $plan);

        return Vec\map($copies, static fn (SeatingTable|SeatingRow|SeatingSeat $copy): string => $copy->getId()->toRfc4122());
    }

    /**
     * @param list<array{kind: 'table'|'row'|'seat', id: string, version: int}> $items
     *
     * @return list<array{guestId: string, from: array{kind: 'table'|'row'|'seat', id: string, seat: int}, to: null}> each freed guest's move to Without a seat
     */
    public function deleteFurniture(Event $event, SeatingPlan $plan, User $by, array $items, bool $emptyOnly = false): array
    {
        $this->somethingChosen($items);

        $freed = $this->locked($plan, function () use ($by, $plan, $items, $emptyOnly): array {
            $found = $this->unchangedItems($plan, $items);
            $freed = [];

            foreach ($found as $item) {
                foreach ($this->seatAssignmentRepository->findAt($item->getId()) as $there) {
                    if ($emptyOnly) {
                        throw new ApiException(ErrorCode::SeatingUndoStale, 'seating.undo_stale');
                    }

                    $freed[] = ['guestId' => $there->getGuest()->getId()->toRfc4122(), 'from' => GuestSeater::refOf($item, $there->getSeat()), 'to' => null];
                    $this->auditor->record(GuestSeater::MOVED, 'Guest', $there->getGuest()->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(['seat' => GuestSeater::placeName($item) . ' #' . $there->getSeat()], ['seat' => null]));
                    $this->entityManager->remove($there);
                }
            }

            foreach ($found as $item) {
                $this->auditor->record(self::deletedAs($item), self::auditedAs($item), $item->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff($this->recordedItem($item), []));
                $this->entityManager->remove($item);
            }

            return $freed;
        });

        $this->published($event, $plan);

        return $freed;
    }

    /** @param list<array{kind: 'table'|'row'|'seat', name: string, sectionId: ?string, xCm: int, yCm: int, shape?: TableShape, seats?: int, widthCm?: int, lengthCm?: int, endSeats?: int, rotation?: int, spacingCm?: int, unusableSeats?: list<int>, unusable?: bool, guests?: list<array{guestId: string, seat: int}>}> $items */
    public function restoreFurniture(Event $event, SeatingPlan $plan, User $by, array $items): array
    {
        $this->somethingChosen($items);

        $restored = $this->locked($plan, function () use ($event, $plan, $by, $items): array {
            $tables = $this->seatingTableRepository->findInPlan($plan);
            $rows = $this->seatingRowRepository->findInPlan($plan);
            $seats = $this->seatingSeatRepository->findInPlan($plan);
            $system = self::systemOf($event);
            $restored = [];
            $violations = [];

            foreach ($items as $index => $item) {
                try {
                    $back = $this->restored($plan, $item, $tables, $rows, $seats, $system, $by);
                } catch (ApiException $refused) {
                    $violations = [...$violations, ...self::under('items[' . $index . ']', $refused)];

                    continue;
                }

                if ($back instanceof SeatingTable) {
                    $tables[] = $back;
                } elseif ($back instanceof SeatingRow) {
                    $rows[] = $back;
                } else {
                    $seats[] = $back;
                }

                if (!FloorGeometry::inside($back, $plan->getWidthCm(), $plan->getLengthCm())) {
                    $violations[] = $this->seatingRules->arrangeViolation('items[' . $index . ']', 'validation.seating_outside_room', ['{name}' => self::nameOf($back)]);

                    continue;
                }

                $restored[] = $back;
            }

            if ([] !== $violations) {
                throw ApiException::validation($violations);
            }

            $reseated = $this->reseated($event, $restored, $items);

            foreach ($restored as $back) {
                $this->entityManager->persist($back);
                $this->auditor->record(self::addedAs($back), self::auditedAs($back), $back->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], $this->recordedItem($back)));
            }

            foreach ($reseated as $assignment) {
                $this->entityManager->persist($assignment);
                $this->auditor->record(GuestSeater::MOVED, 'Guest', $assignment->getGuest()->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(['seat' => null], ['seat' => GuestSeater::placeName($assignment->getPlace()) . ' #' . $assignment->getSeat()]));
            }

            return $restored;
        });

        $this->published($event, $plan);

        return Vec\map($restored, static fn (SeatingTable|SeatingRow|SeatingSeat $back): string => $back->getId()->toRfc4122());
    }

    /**
     * @param list<SeatingTable|SeatingRow|SeatingSeat>                          $restored in the order of `$items`
     * @param list<array{guests?: list<array{guestId: string, seat: int}>, ...}> $items
     *
     * @return list<SeatAssignment>
     */
    private function reseated(Event $event, array $restored, array $items): array
    {
        $wanted = [];

        foreach ($items as $index => $item) {
            foreach ($item['guests'] ?? [] as $one) {
                $wanted[] = ['place' => $restored[$index], 'guestId' => $one['guestId'], 'seat' => $one['seat']];
            }
        }

        $guests = [];

        foreach ($wanted as $one) {
            $guest = Uuid::isValid($one['guestId']) ? $this->guestRepository->findOneInEvent($event->getId(), Uuid::fromString($one['guestId'])) : null;

            if (null === $guest || !GuestSeater::mayBeSeated($guest) || !Iter\contains(GuestSeater::usableChairs($one['place']), $one['seat'])) {
                throw new ApiException(ErrorCode::SeatingUndoStale, 'seating.undo_stale');
            }

            $guests[] = $guest;
        }

        $chairs = Vec\map($wanted, static fn (array $one): string => $one['place']->getId()->toRfc4122() . ':' . $one['seat']);

        if (Iter\count(Vec\unique($chairs)) !== Iter\count($chairs) || Iter\count(Vec\unique(Vec\map($wanted, static fn (array $one): string => $one['guestId']))) !== Iter\count($wanted) || [] !== $this->seatAssignmentRepository->findOfGuests($guests)) {
            throw new ApiException(ErrorCode::SeatingUndoStale, 'seating.undo_stale');
        }

        return Vec\map(Vec\zip($guests, $wanted), static fn (array $pair): SeatAssignment => new SeatAssignment($pair[0], $pair[1]['place'], $pair[1]['seat']));
    }

    /**
     * @param array{kind: 'table'|'row'|'seat', name: string, sectionId: ?string, xCm: int, yCm: int, shape?: TableShape, seats?: int, widthCm?: int, lengthCm?: int, endSeats?: int, rotation?: int, spacingCm?: int, unusableSeats?: list<int>, unusable?: bool, guests?: list<array{guestId: string, seat: int}>} $item
     * @param list<SeatingTable>                                                                                                                                                                                                                                                                                     $tables
     * @param list<SeatingRow>                                                                                                                                                                                                                                                                                       $rows
     * @param list<SeatingSeat>                                                                                                                                                                                                                                                                                      $seats
     */
    private function restored(SeatingPlan $plan, array $item, array $tables, array $rows, array $seats, MeasurementSystem $system, User $by): SeatingTable|SeatingRow|SeatingSeat
    {
        $section = $this->sectionIn($plan, $item['sectionId']);
        $unusable = Vec\sort($item['unusableSeats'] ?? []);

        if ('table' === $item['kind']) {
            $shape = $item['shape'] ?? TableShape::Round;
            $defaults = $shape->defaults();
            $named = $this->seatingRules->tableName($item['name'], $tables);
            $seatCount = $item['seats'] ?? $defaults['seats'];
            $widthCm = $item['widthCm'] ?? $defaults['widthCm'];
            $lengthCm = $shape->isRound() ? $widthCm : ($item['lengthCm'] ?? $defaults['lengthCm']);
            $endSeats = $item['endSeats'] ?? 0;
            $rotation = $item['rotation'] ?? 0;
            $this->seatingRules->tableLayout($shape, $seatCount, $widthCm, $lengthCm, $endSeats, $rotation, $unusable, $system);
            $back = new SeatingTable($plan, $named['name'], $named['nameKey'], $shape, $item['xCm'], $item['yCm'], $by);
            $back->lay($shape, $seatCount, $widthCm, $lengthCm, $endSeats, $rotation, $unusable);
        } elseif ('row' === $item['kind']) {
            $labelled = $this->seatingRules->rowLabel($item['name'], $rows);
            $seatCount = $item['seats'] ?? SeatingRow::SEATS_DEFAULT;
            $spacingCm = $item['spacingCm'] ?? SeatingRow::SPACING_DEFAULT_CM;
            $rotation = $item['rotation'] ?? 0;
            $this->seatingRules->rowLayout($seatCount, $spacingCm, $rotation, $unusable, $system);
            $back = new SeatingRow($plan, $labelled['label'], $labelled['labelKey'], $item['xCm'], $item['yCm'], $by);
            $back->lay($seatCount, $spacingCm, $rotation, $unusable);
        } else {
            $named = $this->seatingRules->seatName($item['name'], $seats);
            $back = new SeatingSeat($plan, $named['name'], $named['nameKey'], $item['xCm'], $item['yCm'], $by);
            $back->setUnusable($item['unusable'] ?? false);
        }

        $back->setSection($section);

        return $back;
    }

    /** @param list<mixed> $items */
    private function somethingChosen(array $items): void
    {
        if ([] === $items) {
            throw ApiException::validation([$this->seatingRules->arrangeViolation('items', 'validation.seating_arrange_nothing')]);
        }
    }

    /**
     * @param list<array{kind: 'table'|'row'|'seat', id: string, version: int, ...}> $items
     *
     * @return list<SeatingTable|SeatingRow|SeatingSeat>
     */
    private function unchangedItems(SeatingPlan $plan, array $items): array
    {
        if (Iter\count(Vec\unique(Vec\map($items, static fn (array $item): string => $item['kind'] . ':' . $item['id']))) !== Iter\count($items)) {
            throw ApiException::validation([$this->seatingRules->arrangeViolation('items', 'validation.seating_arrange_twice')]);
        }

        $found = Vec\map($items, fn (array $item): SeatingTable|SeatingRow|SeatingSeat => $this->itemIn($plan, $item['kind'], $item['id']));

        foreach ($found as $item) {
            $this->entityManager->refresh($item);
        }

        $stale = Vec\filter_keys($found, static fn (int $index): bool => $found[$index]->getVersion() !== $items[$index]['version']);

        if ([] !== $stale) {
            $changedBy = Iter\first($stale)?->getChangedBy();

            throw new ApiException(ErrorCode::PreconditionFailed, 'seating.changed_since', members: [
                'stale' => Vec\map($stale, static fn (SeatingTable|SeatingRow|SeatingSeat $item): string => $item->getId()->toRfc4122()),
                ...(null === $changedBy ? [] : ['changedBy' => $changedBy->getName()]),
            ]);
        }

        return $found;
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> the refusal's violations, each under `$path` */
    private static function under(string $path, ApiException $refused): array
    {
        return Vec\map($refused->violations, static fn (array $violation): array => [...$violation, 'propertyPath' => $path . '.' . $violation['propertyPath']]);
    }

    private static function nameOf(SeatingTable|SeatingRow|SeatingSeat $item): string
    {
        return $item instanceof SeatingRow ? $item->getLabel() : $item->getName();
    }

    private static function addedAs(SeatingTable|SeatingRow|SeatingSeat $item): string
    {
        return match (true) {
            $item instanceof SeatingTable => self::TABLE_ADDED,
            $item instanceof SeatingRow => self::ROW_ADDED,
            default => self::SEAT_ADDED,
        };
    }

    private static function deletedAs(SeatingTable|SeatingRow|SeatingSeat $item): string
    {
        return match (true) {
            $item instanceof SeatingTable => self::TABLE_DELETED,
            $item instanceof SeatingRow => self::ROW_DELETED,
            default => self::SEAT_DELETED,
        };
    }

    /** @param array{kind: 'table'|'row'|'seat', id: string, version: int, xCm: int, yCm: int, rotation?: int, widthCm?: int, lengthCm?: int} $fields */
    private function reshape(SeatingTable|SeatingRow|SeatingSeat $item, array $fields, MeasurementSystem $system): void
    {
        if ($item instanceof SeatingTable) {
            $shape = $item->getShape();
            $widthCm = $fields['widthCm'] ?? $item->getWidthCm();
            $lengthCm = $shape->isRound() ? $widthCm : ($fields['lengthCm'] ?? $item->getLengthCm());
            $rotation = $fields['rotation'] ?? $item->getRotation();
            $this->seatingRules->tableLayout($shape, $item->getSeats(), $widthCm, $lengthCm, $item->getEndSeats(), $rotation, $item->getUnusableSeats(), $system);
            $item->lay($shape, $item->getSeats(), $widthCm, $lengthCm, $item->getEndSeats(), $rotation, $item->getUnusableSeats());

            return;
        }

        $sized = Iter\contains_key($fields, 'widthCm') || Iter\contains_key($fields, 'lengthCm');

        if ($item instanceof SeatingRow) {
            if ($sized) {
                throw ApiException::validation([$this->seatingRules->arrangeViolation('widthCm', 'validation.seating_arrange_table_only')]);
            }

            $rotation = $fields['rotation'] ?? $item->getRotation();
            $this->seatingRules->rowLayout($item->getSeats(), $item->getSpacingCm(), $rotation, $item->getUnusableSeats(), $system);
            $item->lay($item->getSeats(), $item->getSpacingCm(), $rotation, $item->getUnusableSeats());

            return;
        }

        if ($sized || Iter\contains_key($fields, 'rotation')) {
            throw ApiException::validation([$this->seatingRules->arrangeViolation($sized ? 'widthCm' : 'rotation', $sized ? 'validation.seating_arrange_table_only' : 'validation.seating_seat_does_not_turn')]);
        }
    }

    private function itemIn(SeatingPlan $plan, string $kind, string $id): SeatingTable|SeatingRow|SeatingSeat
    {
        $uuid = Uuid::isValid($id) ? Uuid::fromString($id) : null;
        $item = null === $uuid ? null : match ($kind) {
            'table' => $this->seatingTableRepository->find($uuid),
            'row' => $this->seatingRowRepository->find($uuid),
            default => $this->seatingSeatRepository->find($uuid),
        };

        return null !== $item && $item->getPlan()->getId()->equals($plan->getId()) ? $item : throw ApiException::notFound('seating.no_such_item');
    }

    /** @return array<string, mixed> */
    private function recordedItem(SeatingTable|SeatingRow|SeatingSeat $item): array
    {
        return match (true) {
            $item instanceof SeatingTable => self::tableRecorded($item),
            $item instanceof SeatingRow => self::rowRecorded($item),
            default => self::seatRecorded($item),
        };
    }

    private static function auditedAs(SeatingTable|SeatingRow|SeatingSeat $item): string
    {
        return match (true) {
            $item instanceof SeatingTable => 'SeatingTable',
            $item instanceof SeatingRow => 'SeatingRow',
            default => 'SeatingSeat',
        };
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
        if (null === $copying) {
            $named = $this->nextTableName($tables);
            $table = new SeatingTable($plan, $named['name'], $named['nameKey'], $shape, $xCm, $yCm, $by);
        } else {
            $table = $this->tableCopy($plan, $tables, $copying, $xCm, $yCm, $by);
        }

        [$x, $y] = FloorGeometry::nearestFree($table, $this->furniture($plan), $plan, $xCm, $yCm);
        $table->moveTo($x, $y);
        $this->entityManager->persist($table);

        return $table;
    }

    /** @param list<SeatingTable> $tables the plan's tables before this one */
    private function tableCopy(SeatingPlan $plan, array $tables, SeatingTable $original, int $xCm, int $yCm, User $by): SeatingTable
    {
        $named = $this->nextTableName($tables);
        $copy = new SeatingTable($plan, $named['name'], $named['nameKey'], $original->getShape(), $xCm, $yCm, $by);
        $copy->setSection($original->getSection());
        $copy->lay($original->getShape(), $original->getSeats(), $original->getWidthCm(), $original->getLengthCm(), $original->getEndSeats(), $original->getRotation(), $original->getUnusableSeats());

        return $copy;
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

    /**
     * Refuses, 409, seats lowered below the guests seated there or an unusable mark on a taken chair (sc-4013); at a table, guests in chairs a lower count takes away move into its first run of free chairs, in order and side by side where they fit.
     *
     * @param list<int> $unusable
     */
    private function keepTheSeated(SeatingTable|SeatingRow|SeatingSeat $place, int $seats, array $unusable): void
    {
        $there = $this->seatAssignmentRepository->findAt($place->getId());

        foreach ($there as $at) {
            if (Iter\contains($unusable, $at->getSeat())) {
                throw new ApiException(ErrorCode::SeatingGuestsSeated, 'seating.seat_in_use', members: ['field' => $place instanceof SeatingSeat ? 'unusable' : 'unusableSeats'], parameters: ['{name}' => $this->guestSeater->nameOf($at->getGuest())]);
            }
        }

        $past = Vec\filter($there, static fn (SeatAssignment $at): bool => $at->getSeat() > $seats);

        if ([] === $past) {
            return;
        }

        if ($place instanceof SeatingRow) {
            $last = $there[Iter\count($there) - 1];

            throw new ApiException(ErrorCode::SeatingGuestsSeated, 'seating.row_below_seated', members: ['field' => 'seats'], parameters: ['{name}' => $this->guestSeater->nameOf($last->getGuest()), '{seat}' => $last->getSeat(), '{keep}' => $last->getSeat()]);
        }

        $usable = Vec\filter(Vec\range(1, $seats), static fn (int $seat): bool => !Iter\contains($unusable, $seat));
        $count = Iter\count($there);

        if ($count > Iter\count($usable)) {
            $keep = $count;
            while (Iter\count(Vec\filter(Vec\range(1, $keep), static fn (int $seat): bool => !Iter\contains($unusable, $seat))) < $count) {
                ++$keep;
            }

            throw new ApiException(ErrorCode::SeatingGuestsSeated, 'seating.table_below_seated', members: ['field' => 'seats'], parameters: ['{count}' => $count, '{keep}' => $keep]);
        }

        $taken = Vec\map(Vec\filter($there, static fn (SeatAssignment $at): bool => $at->getSeat() <= $seats), static fn (SeatAssignment $at): int => $at->getSeat());
        $free = Vec\filter($usable, static fn (int $seat): bool => !Iter\contains($taken, $seat));

        $moving = Iter\count($past);
        $chairs = Vec\take($free, $moving);
        foreach (Vec\range(1, $seats) as $start) {
            $run = Vec\map(Vec\range(0, $moving - 1), static fn (int $step): int => (($start - 1 + $step) % $seats) + 1);

            if (Iter\all($run, static fn (int $seat): bool => Iter\contains($free, $seat))) {
                $chairs = $run;
                break;
            }
        }

        foreach (Vec\values($past) as $index => $at) {
            $at->renumber($chairs[$index]);
        }
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

    /**
     * Tells everyone with the plan open what this editor has chosen, or that they chose nothing; kept nowhere, so it is never a lock (sc-4719).
     *
     * @param array{kind: 'table'|'row'|'seat', id: string, chair?: int|null}|null $chosen `chair` is one of a table's chairs, by its number
     */
    public function announceChoice(Event $event, SeatingPlan $plan, User $user, ?array $chosen): void
    {
        $item = null === $chosen ? null : $this->itemIn($plan, $chosen['kind'], $chosen['id']);
        $chair = $item instanceof SeatingTable ? $chosen['chair'] ?? null : null;
        if ($item instanceof SeatingTable && null !== $chair && ($chair < 1 || $chair > $item->getSeats())) {
            throw ApiException::notFound('seating.no_such_item');
        }

        $this->realtimePublisher->publish(RealtimeTopic::EventSeatingChoices, $event->getId()->toRfc4122(), [
            'userId' => $user->getId()->toRfc4122(),
            'chosen' => null === $item || null === $chosen ? null : [
                'kind' => $chosen['kind'],
                'id' => $item->getId()->toRfc4122(),
                'chair' => $chair,
            ],
        ]);
    }

    /** Tells everyone with the plan open that this person still has it open, so a connection that died without a word is let go of within seconds rather than when the hub notices (sc-4719). */
    public function announceHere(Event $event, User $user): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventSeatingChoices, $event->getId()->toRfc4122(), [
            'userId' => $user->getId()->toRfc4122(),
            'here' => true,
        ]);
    }

    private static function changedSince(?User $changedBy): ApiException
    {
        $name = $changedBy?->getName();

        return new ApiException(ErrorCode::PreconditionFailed, 'seating.changed_since', members: null === $name ? [] : ['changedBy' => $name]);
    }

    /** $door: the step may change the words of somebody's seat, so the open doors read their list again (sc-60684); a move, a turn, a resize or new empty furniture leaves them quiet. */
    private function published(Event $event, ?SeatingPlan $plan, bool $door = true): void
    {
        if ($door) {
            $this->checkInSignal->send($event);
        }

        $this->seatingNumbersPublisher->publish($event);
        $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $event->getId()->toRfc4122(), $this->seatingSerialiser->seating($event, $plan));
        null === $plan ? $this->guestPageSignal->send($event) : $this->guestPageSignal->seatingChanged($event);
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
