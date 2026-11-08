<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Audit\Auditor;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MeasurementSystem;
use App\Enum\RealtimeTopic;
use App\Enum\SectionColour;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\SeatingPlanRepository;
use App\Repository\SeatingSectionRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/**
 * Every change to an event's room and its sections (sc-3998). Each runs under a lock on the plan's row, so two saves
 * sent together queue: the second is refused 412 when it was made against what the first changed, and the 30-section
 * limit and a name's uniqueness are read after the first has landed. The room and each section have their own
 * version, so adding a section never refuses a colleague's Room settings.
 */
final readonly class SeatingPlanEditor
{
    public const string STARTED = 'seating.plan_started';

    public const string CHANGED = 'seating.plan_changed';

    public const string DELETED = 'seating.plan_deleted';

    public const string SECTION_ADDED = 'seating.section_added';

    public const string SECTION_CHANGED = 'seating.section_changed';

    public const string SECTION_DELETED = 'seating.section_deleted';

    public function __construct(
        private SeatingRules $seatingRules,
        private SeatingPlanRepository $seatingPlanRepository,
        private SeatingSectionRepository $seatingSectionRepository,
        private SeatingSerialiser $seatingSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
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

    /**
     * A field left out keeps its value; a room name sent as null or blank removes it.
     *
     * @param array{roomName?: ?string, widthCm?: int, lengthCm?: int} $fields
     */
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

    /** Its sections go with it; the guest list is never touched (sc-3998). */
    public function delete(Event $event, SeatingPlan $plan, User $by): void
    {
        $this->locked($plan, function () use ($plan, $by): void {
            $this->auditor->record(self::DELETED, 'SeatingPlan', $plan->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::recorded($plan), []));

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

        $this->locked($plan, function () use ($section, $by): void {
            $this->auditor->record(self::SECTION_DELETED, 'SeatingSection', $section->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::sectionRecorded($section), []));
            $this->entityManager->remove($section);
        });

        $this->published($event, $plan);
    }

    public static function systemOf(Event $event): MeasurementSystem
    {
        return MeasurementSystem::forTerritory($event->getOrganisation()->getCountryCode());
    }

    /**
     * Runs the change with the plan's row locked, then flushes.
     *
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

    /** A save made against a version somebody has since moved on is refused, naming who did when it is known. */
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
    private static function sectionRecorded(SeatingSection $section): array
    {
        return ['name' => $section->getName(), 'colour' => $section->getColour()->value];
    }
}
