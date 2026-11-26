<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Interfaces\ArrivalFollowerInterface;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Menu\Interfaces\ServingStationsInterface;
use App\Domain\Service\Model\ServingTable;
use App\Domain\Staff\Station\ServiceTables;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\ServiceItem;
use App\Entity\ServicePlate;
use App\Entity\ServiceStep;
use App\Entity\ServiceTray;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\HeldChoice;
use App\Enum\ItemMark;
use App\Enum\ItemState;
use App\Enum\OwedReason;
use App\Enum\Permission;
use App\Enum\PlateStage;
use App\Enum\PlateStep;
use App\Enum\SentBackReason;
use App\Enum\ServicePlace;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Repository\ServiceItemRepository;
use App\Repository\ServicePlateRepository;
use App\Repository\ServiceStepRepository;
use App\Repository\ServiceTrayRepository;
use App\Repository\UserRepository;
use Closure;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @phpstan-import-type Before from ServiceStep
 * @phpstan-import-type Made from ServiceStep
 */
final readonly class ServiceSteps implements ArrivalFollowerInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private ServingTables $servingTables,
        private ServiceTables $serviceTables,
        private OrderMaker $orderMaker,
        private ServiceRead $serviceRead,
        private ServiceChanges $serviceChanges,
        private ServingStationsInterface $servingStations,
        private GuestNeedsRecord $guestNeedsRecord,
        private ServiceItemRepository $serviceItemRepository,
        private ServicePlateRepository $servicePlateRepository,
        private ServiceTrayRepository $serviceTrayRepository,
        private ServiceStepRepository $serviceStepRepository,
        private UserRepository $userRepository,
        private TranslatorInterface $translator,
    ) {
    }

    public function fire(MenuCourse $course, ServingTable $table, User $by): void
    {
        $this->write($course->getEvent(), [], function (DateTimeImmutable $now) use ($course, $table, $by): void {
            $this->orderMaker->fire($course, $table, $now, $by);
        });
    }

    public function arrived(Guest $guest, User $by): void
    {
        if (!$guest->hasArrived() || !$this->orderMaker->isFiredFor($guest)) {
            return;
        }

        $this->write($guest->getEvent(), [], function (DateTimeImmutable $now) use ($guest, $by): void {
            $this->orderMaker->arrived($guest, $now, $by);
        });
    }

    public function markItem(MenuCourse $course, string $itemKey, ItemState $state, ?int $readyIn, Grants $grants, User $by): void
    {
        $grants->requireServiceAt(ServicePlace::Pass);

        if (null !== $readyIn && (ItemState::Ready === $state || !Iter\contains(ItemState::readyIn(), $readyIn))) {
            throw $this->invalid('readyIn', 'service.ready_in_invalid');
        }

        $this->write($course->getEvent(), [], function (DateTimeImmutable $now) use ($course, $itemKey, $state, $readyIn, $by): void {
            if (!Iter\contains($this->itemKeys($course), $itemKey)) {
                throw $this->invalid('item', 'service.item_not_on_course');
            }

            $item = $this->serviceItemRepository->findOneOf($course, $itemKey);
            $before = null === $item ? self::nothing() : self::before(items: [$item]);
            $made = self::none();

            if (null === $item) {
                $item = new ServiceItem($course, $itemKey);
                $this->entityManager->persist($item);
                $made['items'][] = $item->getId()->toRfc4122();
            }

            $item->mark($state, $readyIn, $now, $by);
            $this->recorded($course->getEvent(), 'item', $before, $made, $by, $now);
        });
    }

    public function choose(ServicePlate $order, HeldChoice $choice, Grants $grants, User $by): void
    {
        $this->requireTable($order, $grants, $by);
        $this->write($order->getEvent(), [$order], function (DateTimeImmutable $now) use ($order, $choice, $by): void {
            $states = $this->serviceRead->states($order->getCourse());

            if (!$order->isOrder() || $order->isOwed() || PlateStage::ToServe !== $order->getStage() || [] === ServiceRules::preparing($order, $states) || null !== $order->getTray()) {
                throw self::stageInvalid();
            }

            if (HeldChoice::WhatsReadyNow === $choice && Iter\count(ServiceRules::preparing($order, $states)) === Iter\count($order->getItems())) {
                throw new ApiException(ErrorCode::PlateEmpty, 'service.plate_empty');
            }

            $before = self::before(plates: [$order]);
            $order->choose($choice);
            $this->recorded($order->getEvent(), 'choose', $before, self::none(), $by, $now);
        });
    }

    public function start(MenuCourse $course, string $tableKey, Grants $grants, User $by): ServiceTray
    {
        $table = $this->servingTables->find($course->getEvent(), $tableKey) ?? throw ApiException::notFound('access.not_found');
        $this->serviceTables->requireYours($grants, $by, $table->section);

        return $this->write($course->getEvent(), [], function (DateTimeImmutable $now) use ($course, $table, $by): ServiceTray {
            $states = $this->serviceRead->states($course);
            $plates = Vec\take($this->serviceRead->waiting($course, $table, $states), ServiceRules::PLATES_PER_TRIP);

            if ([] === $plates) {
                throw new ApiException(ErrorCode::TableNothingToServe, 'service.table_nothing_to_serve');
            }

            $before = self::before(plates: $plates);
            $tray = new ServiceTray($course, $table->key, $by, $now);
            $this->entityManager->persist($tray);

            foreach ($plates as $plate) {
                $toFollow = $plate->isOwed() ? [] : ServiceRules::preparing($plate, $this->serviceRead->states($plate->getCourse()));
                $plate->putOn($tray, $toFollow, $now, $by);
            }

            $this->recorded($course->getEvent(), 'start', $before, [...self::none(), 'trays' => [$tray->getId()->toRfc4122()]], $by, $now);

            return $tray;
        });
    }

    public function mark(ServiceTray $tray, ServicePlate $plate, string $itemKey, ?ItemMark $mark, Grants $grants, User $by): void
    {
        $this->requireTray($tray, $grants, $by);
        $this->write($tray->getEvent(), [$tray, $plate], function (DateTimeImmutable $now) use ($tray, $plate, $itemKey, $mark, $by): void {
            if ($plate->getTray() !== $tray || PlateStage::Dishing !== $plate->getStage()) {
                throw self::stageInvalid();
            }

            $keys = Vec\map($plate->onThePlate(), static fn (array $item): string => $item['key']);

            if (!Iter\contains($keys, $itemKey)) {
                throw $this->invalid('item', 'service.item_not_on_plate');
            }

            $marks = $plate->getMarks();

            if (ItemMark::BringAfter === $mark && Iter\all(Vec\filter($keys, static fn (string $key): bool => $key !== $itemKey), static fn (string $key): bool => isset($marks[$key]) && ItemMark::On !== $marks[$key])) {
                throw new ApiException(ErrorCode::PlateEmpty, 'service.plate_empty');
            }

            $before = self::before(plates: [$plate]);
            $plate->mark($itemKey, $mark);
            $this->recorded($tray->getEvent(), 'mark', $before, self::none(), $by, $now);
        });
    }

    public function check(ServiceTray $tray, Grants $grants, User $by): void
    {
        $this->requireTray($tray, $grants, $by);
        $this->write($tray->getEvent(), [$tray], function (DateTimeImmutable $now) use ($tray, $by): void {
            $plates = $this->servicePlateRepository->findOnTray($tray);

            if ([] === $plates || !Iter\all($plates, static fn (ServicePlate $plate): bool => PlateStage::Dishing === $plate->getStage())) {
                throw self::stageInvalid();
            }

            $missing = [];

            foreach ($plates as $plate) {
                foreach ($plate->onThePlate() as $item) {
                    $mark = $plate->getMarks()[$item['key']] ?? null;

                    if (ItemMark::On !== $mark && ItemMark::BringAfter !== $mark) {
                        $missing[] = ['plateId' => $plate->getId()->toRfc4122(), 'item' => $item['key']];
                    }
                }
            }

            if ([] !== $missing) {
                throw new ApiException(ErrorCode::TrayCheckIncomplete, 'service.tray_check_incomplete', members: ['missing' => $missing]);
            }

            $this->stepTray($tray, $plates, PlateStep::Check, $by, $now);
        });
    }

    public function takeOff(ServiceTray $tray, ServicePlate $plate, Grants $grants, User $by): void
    {
        $this->requireTray($tray, $grants, $by);
        $this->write($tray->getEvent(), [$tray, $plate], function (DateTimeImmutable $now) use ($tray, $plate, $by): void {
            if ($plate->getTray() !== $tray || !$plate->getStage()->allows(PlateStep::TakeOff)) {
                throw self::stageInvalid();
            }

            $before = self::before(plates: [$plate]);
            $plate->takeOff($now, $by);
            $this->recorded($tray->getEvent(), 'takeOff', $before, self::none(), $by, $now);
        });
    }

    public function takeToTable(ServiceTray $tray, Grants $grants, User $by): void
    {
        $this->requireTray($tray, $grants, $by);
        $this->write($tray->getEvent(), [$tray], function (DateTimeImmutable $now) use ($tray, $by): void {
            $plates = $this->servicePlateRepository->findOnTray($tray);

            if ([] === $plates || !Iter\all($plates, static fn (ServicePlate $plate): bool => PlateStage::Checked === $plate->getStage())) {
                throw self::stageInvalid();
            }

            $this->stepTray($tray, $plates, PlateStep::TakeToTable, $by, $now);
        });
    }

    public function tick(ServiceTray $tray, ServicePlate $plate, Grants $grants, User $by): void
    {
        $this->requireTray($tray, $grants, $by);
        $this->write($tray->getEvent(), [$tray, $plate], function (DateTimeImmutable $now) use ($tray, $plate, $by): void {
            if ($plate->getTray() !== $tray || PlateStage::OnItsWay !== $plate->getStage()) {
                throw self::stageInvalid();
            }

            $before = self::before(plates: [$plate]);
            $made = $this->served($plate, $by, $now);
            $this->recorded($tray->getEvent(), 'serve', $before, [...self::none(), 'plates' => $made], $by, $now);
        });
    }

    /** @return array{ticked: int, left: int} every plate On its way but a flagged guest's, who is ticked by their own name */
    public function allServed(ServiceTray $tray, Grants $grants, User $by): array
    {
        $this->requireTray($tray, $grants, $by);

        return $this->write($tray->getEvent(), [$tray], function (DateTimeImmutable $now) use ($tray, $by): array {
            $onItsWay = Vec\filter($this->servicePlateRepository->findOnTray($tray), static fn (ServicePlate $plate): bool => PlateStage::OnItsWay === $plate->getStage());

            if ([] === $onItsWay) {
                throw self::stageInvalid();
            }

            $needs = $this->guestNeedsRecord->of(Vec\map($onItsWay, static fn (ServicePlate $plate): Guest => $plate->getGuest()));
            $ticking = Vec\filter($onItsWay, static fn (ServicePlate $plate): bool => !ServiceRules::isFlagged($needs[$plate->getGuest()->getId()->toRfc4122()] ?? GuestNeeds::none()));

            if ([] !== $ticking) {
                $before = self::before(plates: $ticking, trays: [$tray]);
                $made = Vec\flat_map($ticking, fn (ServicePlate $plate): array => $this->served($plate, $by, $now));
                $tray->stepped(PlateStep::Serve, $now, $by);
                $this->recorded($tray->getEvent(), 'allServed', $before, [...self::none(), 'plates' => $made], $by, $now);
            }

            return ['ticked' => Iter\count($ticking), 'left' => Iter\count($onItsWay) - Iter\count($ticking)];
        });
    }

    public function sendBack(ServicePlate $plate, SentBackReason $reason, Grants $grants, User $by): void
    {
        $this->requireTable($plate, $grants, $by);
        $this->write($plate->getEvent(), [$plate], function (DateTimeImmutable $now) use ($plate, $reason, $by): void {
            if (!$plate->getStage()->allows(PlateStep::SendBack)) {
                throw self::stageInvalid();
            }

            $before = self::before(plates: [$plate]);
            $plate->sendBack($reason, $now, $by);
            $this->recorded($plate->getEvent(), 'sendBack', $before, self::none(), $by, $now);
        });

        if (SentBackReason::AllergyConcern === $reason) {
            $this->serviceChanges->alert($plate, $reason);
        }
    }

    public function undo(Event $event, string $subject, Grants $grants, User $by): void
    {
        $grants->require(Permission::ServiceWork);
        $this->write($event, [], function (DateTimeImmutable $now) use ($event, $subject, $grants, $by): void {
            $step = $this->serviceStepRepository->findLastOn($event, $subject) ?? throw ApiException::notFound('access.not_found');

            if ($now->getTimestamp() - $step->getAt()->getTimestamp() > ServiceRules::UNDO_SECONDS) {
                throw new ApiException(ErrorCode::UndoExpired, 'service.undo_expired');
            }

            if (!$step->getBy()->getId()->equals($by->getId()) && !$grants->holds(Permission::ServiceManage)) {
                throw ApiException::permissionRequired(Permission::ServiceManage);
            }

            foreach ($step->getSubjects() as $other) {
                if (!$this->serviceStepRepository->findLastOn($event, $other)?->getId()->equals($step->getId())) {
                    throw new ApiException(ErrorCode::Conflict, 'service.undo_not_last');
                }
            }

            $this->restore($step);
            $step->undo();
        });
    }

    /**
     * @template T
     * @param list<object>                  $fresh what the caller loaded before the lock, read again under it
     * @param Closure(DateTimeImmutable): T $work
     * @return T
     */
    private function write(Event $event, array $fresh, Closure $work): mixed
    {
        $before = [];
        $result = $this->entityManager->wrapInTransaction(function () use ($event, $fresh, $work, &$before): mixed {
            $this->entityManager->lock($event, LockMode::PESSIMISTIC_WRITE);

            foreach ($fresh as $entity) {
                $this->entityManager->refresh($entity);
            }

            $before = $this->serviceChanges->reads($event);
            $result = $work($this->clock->now());
            $this->entityManager->flush();

            return $result;
        });
        $this->serviceChanges->published($event, $before);

        return $result;
    }

    private function requireTable(ServicePlate $plate, Grants $grants, User $by): void
    {
        $this->serviceTables->requireYours($grants, $by, $this->servingTables->find($plate->getEvent(), $plate->getTableKey())?->section);
    }

    private function requireTray(ServiceTray $tray, Grants $grants, User $by): void
    {
        $grants->require(Permission::ServiceWork);

        if (!$tray->getWaiter()->getId()->equals($by->getId()) && !$grants->holds(Permission::ServiceManage)) {
            throw new ApiException(ErrorCode::TrayNotYours, 'service.tray_not_yours', members: ['waiter' => ['id' => $tray->getWaiter()->getId()->toRfc4122(), 'name' => $tray->getWaiter()->getName()]], parameters: ['{name}' => $tray->getWaiter()->getName()]);
        }
    }

    /** @param list<ServicePlate> $plates */
    private function stepTray(ServiceTray $tray, array $plates, PlateStep $step, User $by, DateTimeImmutable $now): void
    {
        $before = self::before(plates: $plates, trays: [$tray]);

        foreach ($plates as $plate) {
            $plate->moved($step, $now, $by);
        }

        $tray->stepped($step, $now, $by);
        $this->recorded($tray->getEvent(), $step->value, $before, self::none(), $by, $now);
    }

    /** @return list<string> the owed plates it made: the items Brought after, and those left To follow */
    private function served(ServicePlate $plate, User $by, DateTimeImmutable $now): array
    {
        $made = [];
        $plate->moved(PlateStep::Serve, $now, $by);
        $items = Dict\from_entries(Vec\map($plate->getItems(), static fn (array $item): array => [$item['key'], $item]));
        $bringAfter = Vec\filter_nulls(Vec\map(Vec\keys(Dict\filter($plate->getMarks(), static fn (ItemMark $mark): bool => ItemMark::BringAfter === $mark)), static fn (string $key): ?array => $items[$key] ?? null));
        $toFollow = Vec\filter_nulls(Vec\map($plate->getToFollow(), static fn (string $key): ?array => $items[$key] ?? null));

        foreach ([[OwedReason::BringAfter, $bringAfter], [OwedReason::ToFollow, $toFollow]] as [$reason, $owedItems]) {
            if ([] !== $owedItems) {
                $owed = ServicePlate::owed($plate, $owedItems, $reason, $now, $by);
                $this->entityManager->persist($owed);
                $made[] = $owed->getId()->toRfc4122();
            }
        }

        return $made;
    }

    /** @return list<string> */
    private function itemKeys(MenuCourse $course): array
    {
        $entry = Iter\search($this->servingStations->of($course->getEvent())['courses'], static fn (array $one): bool => $one['course']->getId()->equals($course->getId()));

        return [...Vec\map($entry['items'] ?? [], static fn (array $item): string => $item['key']), OrderMaker::CHEFS_CHOICE];
    }

    /**
     * @param Before $before
     * @param Made   $made
     */
    private function recorded(Event $event, string $kind, array $before, array $made, User $by, DateTimeImmutable $now): void
    {
        $subjects = Vec\unique([
            ...Vec\keys($before['plates']), ...Vec\keys($before['trays']), ...Vec\keys($before['items']),
            ...$made['plates'], ...$made['trays'], ...$made['items'],
        ]);
        $this->entityManager->persist(new ServiceStep($event, $kind, Vec\map($subjects, static fn (int|string $id): string => (string) $id), $before, $made, $by, $now));
    }

    private function restore(ServiceStep $step): void
    {
        $before = $step->getBefore();
        $made = $step->getMade();

        foreach ($before['plates'] as $id => $snapshot) {
            $plate = $this->servicePlateRepository->find(Uuid::fromString($id));
            /** @var array{stage: string, tray: ?string, marks: array<string, string>, choice: ?string, toFollow: list<string>, steps: list<array{stage: string, at: string, by: string}>, owedReason: ?string, owedAt: ?string, sentBack: list<array{reason: string, at: string, by: string, stage: string, steps: list<array{stage: string, at: string, by: string}>}>} $snapshot */
            $plate?->restore($snapshot, null === $snapshot['tray'] ? null : $this->serviceTrayRepository->find(Uuid::fromString($snapshot['tray'])));
        }

        foreach ($before['trays'] as $id => $snapshot) {
            /** @var list<array{step: string, at: string, by: string}> $snapshot */
            $this->serviceTrayRepository->find(Uuid::fromString($id))?->restore($snapshot);
        }

        foreach ($before['items'] as $id => $snapshot) {
            /** @var array{state: string, readyIn: ?int, changedAt: ?string, changedBy: ?string} $snapshot */
            $changedBy = null === $snapshot['changedBy'] ? null : $this->userRepository->find(Uuid::fromString($snapshot['changedBy']));
            $this->serviceItemRepository->find(Uuid::fromString($id))?->restore($snapshot, $changedBy);
        }

        foreach ($made['plates'] as $id) {
            $plate = $this->servicePlateRepository->find(Uuid::fromString($id));

            if (null !== $plate) {
                $this->entityManager->remove($plate);
            }
        }

        $this->entityManager->flush();

        foreach ([...Vec\map($made['trays'], fn (string $id): ?object => $this->serviceTrayRepository->find(Uuid::fromString($id))), ...Vec\map($made['items'], fn (string $id): ?object => $this->serviceItemRepository->find(Uuid::fromString($id)))] as $entity) {
            if (null !== $entity) {
                $this->entityManager->remove($entity);
            }
        }
    }

    /**
     * @param list<ServicePlate> $plates
     * @param list<ServiceTray>  $trays
     * @param list<ServiceItem>  $items
     * @return Before
     */
    private static function before(array $plates = [], array $trays = [], array $items = []): array
    {
        return [
            'plates' => Dict\from_entries(Vec\map($plates, static fn (ServicePlate $plate): array => [$plate->getId()->toRfc4122(), $plate->snapshot()])),
            'trays' => Dict\from_entries(Vec\map($trays, static fn (ServiceTray $tray): array => [$tray->getId()->toRfc4122(), $tray->snapshot()])),
            'items' => Dict\from_entries(Vec\map($items, static fn (ServiceItem $item): array => [$item->getId()->toRfc4122(), $item->snapshot()])),
        ];
    }

    /** @return Before */
    private static function nothing(): array
    {
        return ['plates' => [], 'trays' => [], 'items' => []];
    }

    /** @return Made */
    private static function none(): array
    {
        return ['plates' => [], 'trays' => [], 'items' => []];
    }

    private function invalid(string $field, string $message): ApiException
    {
        return ApiException::validation([['propertyPath' => $field, 'message' => $this->translator->trans($message), 'code' => ErrorCode::ValidationFailed->value]]);
    }

    private static function stageInvalid(): ApiException
    {
        return new ApiException(ErrorCode::PlateStageInvalid, 'service.plate_stage_invalid');
    }
}
