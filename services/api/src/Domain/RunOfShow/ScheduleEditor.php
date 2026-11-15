<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow;

use App\Audit\Auditor;
use App\Domain\RunOfShow\Http\ScheduleSerialiser;
use App\Domain\RunOfShow\Model\ItemDetails;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\RealtimeTopic;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\ScheduleItemRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;

/** Each change runs under a lock on the event's row, so two adds sent together cannot both pass the limit, and is published whole to the event's schedule topic (sc-3893). */
final readonly class ScheduleEditor
{
    public const string ADDED = 'run_of_show.item_added';

    public const string CHANGED = 'run_of_show.item_changed';

    public const string DELETED = 'run_of_show.item_deleted';

    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
        private ScheduleSerialiser $scheduleSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    /** The limit is checked before anything is saved. */
    public function add(Event $event, ItemDetails $details, User $by): ScheduleItem
    {
        $item = $this->locked($event, function () use ($event, $details, $by): ScheduleItem {
            if ($this->scheduleItemRepository->countOnEvent($event) >= ScheduleItem::PER_EVENT_MAXIMUM) {
                throw new ApiException(ErrorCode::ScheduleItemLimit, 'run_of_show.item_limit');
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
