<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Audit\Auditor;
use App\Domain\Staff\StaffRosterPublisher;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\SeatingSection;
use App\Entity\StaffItemStation;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\StationKind;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\SeatingSectionRepository;
use App\Repository\StaffItemStationRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An event's stations (sc-3910). Nobody is ever given a station but by a person doing it. */
final readonly class StationPlan
{
    public const string PLACE_ADDED = 'stations.place_added';

    public const string PLACE_RENAMED = 'stations.place_renamed';

    public const string PLACE_REMOVED = 'stations.place_removed';

    public const string PERSON_PLACED = 'stations.person_placed';

    public const string LEAD_SET = 'stations.lead_set';

    public const string FLOOR_LEAD_SET = 'stations.floor_lead_set';

    public const string ITEM_DISHED_AT = 'stations.item_dished_at';

    public const string WALK_ORDERED = 'stations.walk_ordered';

    private const array SUGGESTED = ['door', 'bar', 'kitchen', 'stage', 'floor'];

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffStationRepository $staffStationRepository,
        private StaffItemStationRepository $staffItemStationRepository,
        private StaffMemberRepository $staffMemberRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private DishedItemsReader $dishedItemsReader,
        private StationRules $stationRules,
        private Auditor $auditor,
        private StaffRosterPublisher $staffRosterPublisher,
        private TranslatorInterface $translator,
    ) {
    }

    public function suggest(Event $event): void
    {
        $pass = $this->translator->trans('stations.pass');
        $this->entityManager->persist(new StaffStation($event, StationKind::Pass, $pass, NameNormaliser::key($pass), null, 0));

        foreach (self::SUGGESTED as $position => $key) {
            $name = $this->translator->trans('stations.place_suggested.' . $key);
            $this->entityManager->persist(new StaffStation($event, StationKind::Place, $name, NameNormaliser::key($name), null, $position + 1));
        }
    }

    public function addPlace(Event $event, string $name, User $by): StaffStation
    {
        return $this->changed($event, function () use ($event, $name, $by): StaffStation {
            $kept = $this->stationRules->placeName($event, $name, null);
            $last = Iter\last($this->staffStationRepository->findPlaces($event));
            $place = new StaffStation($event, StationKind::Place, $kept, NameNormaliser::key($kept), null, null === $last ? 0 : $last->getPosition() + 1);
            $this->entityManager->persist($place);
            $this->audit(self::PLACE_ADDED, $place, $by, ['name' => [null, $kept]]);

            return $place;
        });
    }

    public function renamePlace(StaffStation $place, string $name, User $by): void
    {
        $event = $place->getEvent();

        $this->changed($event, function () use ($event, $place, $name, $by): null {
            $this->refusePass($place);
            $kept = $this->stationRules->placeName($event, $name, $place);
            $this->audit(self::PLACE_RENAMED, $place, $by, ['name' => [$place->getName(), $kept]]);
            $place->setName($kept, NameNormaliser::key($kept));

            return null;
        });
    }

    public function removePlace(StaffStation $place, User $by): void
    {
        $this->changed($place->getEvent(), function () use ($place, $by): null {
            $this->refusePass($place);

            foreach ($this->staffMemberRepository->findBy(['station' => $place]) as $person) {
                $person->setStation(null);
            }

            foreach ($this->staffItemStationRepository->findBy(['station' => $place]) as $row) {
                $this->entityManager->remove($row);
            }

            $this->audit(self::PLACE_REMOVED, $place, $by, ['name' => [$place->getName(), null]]);
            $this->entityManager->remove($place);

            return null;
        });
    }

    /** `$stationId` is a place's id or a seating section's; null takes them off. A lead who leaves stops leading. */
    public function place(StaffMember $person, ?string $stationId, User $by): void
    {
        $event = $person->getEvent();

        $this->changed($event, function () use ($event, $person, $stationId, $by): null {
            $to = null === $stationId ? null : $this->station($event, $stationId);
            $from = $person->getStation();

            if ($from === $to) {
                return null;
            }

            if (null !== $from && $from->getLead() === $person) {
                $from->setLead(null);
            }

            $person->setStation($to);
            $this->auditor->record(self::PERSON_PLACED, 'StaffMember', $person->getId(), Actor::User, $by->getId(), $by->getName(), [
                'station' => [$from?->getName(), $to?->getName()],
            ]);

            return null;
        });
    }

    public function lead(Event $event, string $stationId, ?StaffMember $lead, User $by): void
    {
        $this->changed($event, function () use ($event, $stationId, $lead, $by): null {
            $station = $this->station($event, $stationId);

            if (null !== $lead && $lead->getStation() !== $station) {
                throw ApiException::validation([StationRules::violation('lead', 'stations.lead_not_on_station')]);
            }

            $this->audit(self::LEAD_SET, $station, $by, ['lead' => [$station->getLead()?->getId()->toRfc4122(), $lead?->getId()->toRfc4122()]]);
            $station->setLead($lead);

            return null;
        });
    }

    public function floorLead(Event $event, ?StaffMember $lead, User $by): void
    {
        $this->changed($event, function () use ($event, $lead, $by): null {
            $before = Iter\search($this->staffMemberRepository->findOnEvent($event), static fn (StaffMember $one): bool => $one->isFloorLead());

            if ($before === $lead) {
                return null;
            }

            $before?->setFloorLead(false);
            $this->entityManager->flush();
            $lead?->setFloorLead(true);
            $this->auditor->record(self::FLOOR_LEAD_SET, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
                'floorLead' => [$before?->getId()->toRfc4122(), $lead?->getId()->toRfc4122()],
            ]);

            return null;
        });
    }

    /** A place that gets its first item joins the walking order's end; one that loses its last leaves it. */
    public function dishAt(MenuCourse $course, string $item, string $placeId, User $by): void
    {
        $event = $course->getEvent();

        $this->changed($event, function () use ($event, $course, $item, $placeId, $by): null {
            $place = Uuid::isValid($placeId) ? $this->staffStationRepository->findOneInEvent($event, Uuid::fromString($placeId)) : null;

            if (null === $place || !$place->isPlace()) {
                throw ApiException::validation([StationRules::violation('place', 'stations.not_a_place')]);
            }

            $key = NameNormaliser::key($item);
            $courses = $this->dishedItemsReader->read($event);
            $theCourse = Iter\search($courses, static fn (array $one): bool => $one['course'] === $course);
            $onIt = null !== $theCourse && Iter\any($theCourse['items'], static fn (array $one): bool => $one['key'] === $key);

            if (!$onIt) {
                throw ApiException::validation([StationRules::violation('item', 'stations.item_not_on_course')]);
            }

            $before = DishedItemsReader::counts($courses);
            $row = $this->staffItemStationRepository->findOneOfItem($course, $key);
            $was = $row?->getStation();

            if (StationKind::Pass === $place->getKind()) {
                if (null !== $row) {
                    $this->entityManager->remove($row);
                }
            } elseif (null === $row) {
                $this->entityManager->persist(new StaffItemStation($course, $key, $place));
            } else {
                $row->setStation($place);
            }

            $this->entityManager->flush();
            $after = DishedItemsReader::counts($this->dishedItemsReader->read($event));
            $places = $this->staffStationRepository->findPlaces($event);

            if (StationKind::Place === $place->getKind() && 0 === ($before[$place->getId()->toRfc4122()] ?? 0)) {
                $walked = Vec\filter($places, static fn (StaffStation $one): bool => null !== $one->getWalkPosition());
                $place->setWalkPosition([] === $walked ? 0 : 1 + (int) Math\max(Vec\map($walked, static fn (StaffStation $one): int => (int) $one->getWalkPosition())));
            }

            if (null !== $was && $was !== $place && 0 === ($after[$was->getId()->toRfc4122()] ?? 0)) {
                $was->setWalkPosition(null);
            }

            $this->auditor->record(self::ITEM_DISHED_AT, 'MenuCourse', $course->getId(), Actor::User, $by->getId(), $by->getName(), [
                'item' => [null, NameNormaliser::name($item)],
                'station' => [($was ?? Iter\first($places))?->getName(), $place->getName()],
            ]);

            return null;
        });
    }

    /** @param list<string> $order */
    public function walk(Event $event, array $order, User $by): void
    {
        $this->changed($event, function () use ($event, $order, $by): null {
            $places = $this->staffStationRepository->findPlaces($event);
            $walk = DishedItemsReader::walk($places, DishedItemsReader::counts($this->dishedItemsReader->read($event)));
            $ids = Vec\map($walk, static fn (StaffStation $one): string => $one->getId()->toRfc4122());
            $sorted = static fn (array $list): array => Vec\sort($list);

            if (Iter\count($order) !== Iter\count($ids) || $sorted($order) !== $sorted($ids)) {
                throw ApiException::validation([StationRules::violation('order', 'stations.walk_not_the_stations')]);
            }

            foreach ($order as $position => $id) {
                $stop = Iter\search($walk, static fn (StaffStation $one): bool => $one->getId()->toRfc4122() === $id);
                $stop?->setWalkPosition($position);
            }

            $this->auditor->record(self::WALK_ORDERED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), ['walk' => [$ids, $order]]);

            return null;
        });
    }

    private function station(Event $event, string $id): StaffStation
    {
        if (!Uuid::isValid($id)) {
            throw ApiException::notFound('access.not_found');
        }

        $uuid = Uuid::fromString($id);
        $place = $this->staffStationRepository->findOneInEvent($event, $uuid);

        if (null !== $place && $place->isPlace()) {
            return $place;
        }

        $section = $this->seatingSectionRepository->findOneInEvent($event->getId(), $uuid);

        return null === $section ? throw ApiException::notFound('access.not_found') : $this->sectionRow($event, $section);
    }

    private function sectionRow(Event $event, SeatingSection $section): StaffStation
    {
        $row = $this->staffStationRepository->findOneOfSection($section);

        if (null === $row) {
            $row = new StaffStation($event, StationKind::Section, $section->getName(), $section->getNameKey(), $section, 0);
            $this->entityManager->persist($row);
        } else {
            $row->setName($section->getName(), $section->getNameKey());
        }

        return $row;
    }

    private function refusePass(StaffStation $place): void
    {
        if (StationKind::Pass === $place->getKind()) {
            throw ApiException::validation([StationRules::violation('name', 'stations.pass_fixed')]);
        }
    }

    /**
     * @template T
     *
     * @param callable(): T $change
     *
     * @return T
     */
    private function changed(Event $event, callable $change): mixed
    {
        $done = $this->entityManager->wrapInTransaction(function () use ($event, $change): mixed {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $done = $change();
            $this->entityManager->flush();

            return $done;
        });

        $this->staffRosterPublisher->publish($event);

        return $done;
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function audit(string $action, StaffStation $station, User $by, array $changes): void
    {
        $this->auditor->record($action, 'StaffStation', $station->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
