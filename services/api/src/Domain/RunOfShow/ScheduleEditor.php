<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Audit\Auditor;
use App\Domain\RunOfShow\Http\ScheduleSerialiser;
use App\Domain\RunOfShow\Model\ItemDetails;
use App\Domain\RunOfShow\Model\PressLoss;
use App\Domain\RunOfShow\Model\Replayed;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Entity\SchedulePress;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\PressKind;
use App\Enum\RealtimeTopic;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\ScheduleItemRepository;
use App\Repository\SchedulePressRepository;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;

/** Each change runs under a lock on the event's row, so two adds sent together cannot both pass the limit, and is published whole to the event's schedule topic (sc-3893). */
final readonly class ScheduleEditor
{
    public const string ADDED = 'run_of_show.item_added';

    public const string CHANGED = 'run_of_show.item_changed';

    public const string DELETED = 'run_of_show.item_deleted';

    public const array PRESSED = [
        'start' => 'run_of_show.item_started',
        'done' => 'run_of_show.item_finished',
        'skip' => 'run_of_show.item_skipped',
    ];

    /** A press timed later than this past the server's clock is taken as pressed now. */
    private const string AHEAD_AT_MOST = '+5 seconds';

    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
        private SchedulePressRepository $schedulePressRepository,
        private ScheduleSerialiser $scheduleSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    /** The limit is checked before anything is saved. */
    public function add(Event $event, ItemDetails $details, User $by): ScheduleItem
    {
        $item = $this->locked($event, function () use ($event, $details, $by): ScheduleItem {
            if ($this->scheduleItemRepository->countOnEvent($event) >= ScheduleItem::PER_EVENT_MAXIMUM) {
                throw new ApiException(ErrorCode::ScheduleItemLimit, 'run_of_show.item_limit', parameters: ['{max}' => ScheduleItem::PER_EVENT_MAXIMUM]);
            }

            $item = new ScheduleItem($event, $details->title, $details->startsAt, $by);
            self::describe($item, $details, $by);
            $this->entityManager->persist($item);
            $this->auditor->record(self::ADDED, 'ScheduleItem', $item->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff([], self::recorded($item)));

            return $item;
        });

        $this->published($event);

        return $item;
    }

    /** Needs the version it read; a colleague's change since is 412 with the item as it now stands in `current`. */
    public function change(Event $event, ScheduleItem $item, ?string $ifMatch, ItemDetails $details, User $by): ScheduleItem
    {
        if (null === $ifMatch || '*' === Str\trim($ifMatch)) {
            throw new ApiException(ErrorCode::PreconditionRequired, 'run_of_show.version_required');
        }

        $this->locked($event, function () use ($item, $ifMatch, $details, $by): void {
            $this->entityManager->refresh($item);

            if (!EntityTag::matches($ifMatch, EntityTag::of($item->getVersion()))) {
                $name = $item->getChangedBy()?->getName();

                throw new ApiException(ErrorCode::PreconditionFailed, 'run_of_show.changed_since', members: ['current' => $this->scheduleSerialiser->item($item), 'changedBy' => $name]);
            }

            $before = self::recorded($item);
            self::describe($item, $details, $by);
            $changes = Auditor::diff($before, self::recorded($item));

            if ([] !== $changes) {
                $this->auditor->record(self::CHANGED, 'ScheduleItem', $item->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            }
        });

        $this->published($event);

        return $item;
    }

    /** A press that changes nothing is still kept, so a late earlier press can make it count, unless it would have changed another item on its track; the same key answers as the first time (sc-3895). */
    public function press(Event $event, ScheduleItem $item, PressKind $kind, DateTimeImmutable $pressedAt, string $key, string $fingerprint, User $by): void
    {
        $loss = $this->locked($event, function () use ($event, $item, $kind, $pressedAt, $key, $fingerprint, $by): ?PressLoss {
            $sent = $this->schedulePressRepository->findOneByKey($by, $key);

            if (null !== $sent) {
                if ($sent->getFingerprint() !== $fingerprint) {
                    throw new ApiException(ErrorCode::IdempotencyKeyReused, 'run_of_show.idempotency_key_reused');
                }

                if ($sent->isSetAside()) {
                    return new PressLoss(ErrorCode::TrackBusy, $sent->getSetAsideFor());
                }

                return $this->replayed($event)->losses[$sent->getId()->toRfc4122()] ?? self::answered($sent);
            }

            $press = new SchedulePress($event, $item, $kind, $this->clamped($event, $pressedAt), $key, $fingerprint, $by, $by->getName());
            $this->entityManager->persist($press);
            $this->entityManager->flush();

            $overreach = PressReplay::overreach($this->scheduleItemRepository->findOnEvent($event), $this->schedulePressRepository->findStandingOnEvent($event), $press);

            if (null !== $overreach) {
                $press->setAside($overreach->to);
                $press->setAnswer($overreach->code->value);

                return $overreach;
            }

            $replayed = $this->replayed($event);
            $loss = $replayed->losses[$press->getId()->toRfc4122()] ?? null;
            $press->setAnswer($loss?->code->value);

            if (null === $loss) {
                $this->auditor->record(self::PRESSED[$kind->value], 'ScheduleItem', $item->getId(), Actor::User, $by->getId(), $by->getName(), ['pressedAt' => [null, $press->getPressedAt()->format(\DATE_ATOM)]]);
            }

            return $loss;
        });

        $this->published($event);

        if (null !== $loss) {
            $zone = new DateTimeZone($event->getTimeZone());
            $to = $loss->to;

            throw new ApiException($loss->code, match ($loss->code) {
                ErrorCode::ItemFinished => 'run_of_show.item_finished',
                ErrorCode::ItemStarted => 'run_of_show.item_started',
                ErrorCode::TrackBusy => 'run_of_show.track_busy',
                default => 'run_of_show.item_not_started',
            }, members: null === $to ? [] : ['superseded_by' => [
                'name' => $to->getPressedByName(),
                'at' => $to->getPressedAt()->setTimezone($zone)->format(\DATE_ATOM),
            ]]);
        }
    }

    public function delete(Event $event, ScheduleItem $item, User $by): void
    {
        $this->locked($event, function () use ($item, $by): void {
            $this->auditor->record(self::DELETED, 'ScheduleItem', $item->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(self::recorded($item), []));
            $this->entityManager->remove($item);
        });

        $this->published($event);
    }

    private static function describe(ScheduleItem $item, ItemDetails $details, User $by): void
    {
        $item->describe($details->title, $details->startsAt, $details->lengthMinutes, $details->place, $details->ownerName, $details->ownerRole, $details->note, $details->fixedTime, $details->showToGuests, $by);
    }

    /**
     * @template T
     *
     * @param callable(): T $change
     *
     * @return T
     */
    private function locked(Event $event, callable $change): mixed
    {
        return $this->entityManager->wrapInTransaction(function () use ($event, $change): mixed {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $changed = $change();
            $this->entityManager->flush();

            return $changed;
        });
    }

    /** No later than the server's clock and a few seconds, and no earlier than the event's start (sc-3895). */
    private function clamped(Event $event, DateTimeImmutable $pressedAt): DateTimeImmutable
    {
        $latest = $this->clock->now()->modify(self::AHEAD_AT_MOST);
        $earliest = $event->getStartsAt();
        $at = $pressedAt > $latest ? $latest : $pressedAt;

        return ($at < $earliest ? $earliest : $at)->setTimezone(new DateTimeZone('UTC'));
    }

    /** Writes each item's state as the event's presses now leave it. */
    private function replayed(Event $event): Replayed
    {
        $items = $this->scheduleItemRepository->findOnEvent($event);
        $replayed = PressReplay::of($items, $this->schedulePressRepository->findStandingOnEvent($event));

        foreach ($items as $item) {
            $run = $replayed->runs[$item->getId()->toRfc4122()];
            $item->setStartedAt($run->startedAt);
            $item->setEndedAt($run->endedAt);
            $item->setSkipped($run->skipped);
        }

        return $replayed;
    }

    /** A press sent again whose state the replay no longer refuses keeps the answer it was given the first time. */
    private static function answered(SchedulePress $press): ?PressLoss
    {
        $code = $press->getAnswer();

        return null === $code ? null : new PressLoss(ErrorCode::from($code), null);
    }

    private function published(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventSchedule, $event->getId()->toRfc4122(), $this->scheduleSerialiser->schedule($event));
    }

    /** @return array<string, mixed> */
    private static function recorded(ScheduleItem $item): array
    {
        return [
            'title' => $item->getTitle(),
            'startsAt' => $item->getStartsAt()->format('Y-m-d\TH:i'),
            'lengthMinutes' => $item->getLengthMinutes(),
            'place' => $item->getPlace(),
            'ownerName' => $item->getOwnerName(),
            'ownerRole' => $item->getOwnerRole(),
            'note' => $item->getNote(),
            'fixedTime' => $item->isFixedTime(),
            'showToGuests' => $item->isShownToGuests(),
        ];
    }
}
