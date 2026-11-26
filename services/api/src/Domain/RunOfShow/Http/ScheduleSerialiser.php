<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Http;

use App\Domain\Event\LocalTimeResolver;
use App\Domain\RunOfShow\EventDay;
use App\Domain\RunOfShow\ScheduleRules;
use App\Entity\Event;
use App\Entity\ScheduleItem;
use App\Repository\ScheduleItemRepository;
use DateTimeZone;
use Psl\Vec;

/** An event's running order as the Schedule page reads it, whole, on every answer and every publish (sc-3893). */
final readonly class ScheduleSerialiser
{
    public function __construct(
        private ScheduleItemRepository $scheduleItemRepository,
    ) {
    }

    /** @return array{timeZone: string, earliest: string, latest: string, itemsMaximum: int, items: list<array<string, mixed>>} */
    public function schedule(Event $event): array
    {
        return [
            'timeZone' => $event->getTimeZone(),
            'earliest' => ScheduleRules::earliest($event)->format(\DATE_ATOM),
            'latest' => $event->getEndsAt()->format(\DATE_ATOM),
            'itemsMaximum' => ScheduleItem::PER_EVENT_MAXIMUM,
            'items' => Vec\map($this->scheduleItemRepository->findOnEvent($event), $this->item(...)),
        ];
    }

    /** @return array{id: string, title: string, startsAt: string, startedAt: ?string, endedAt: ?string, skipped: bool, day: string, lengthMinutes: ?int, place: ?string, ownerName: ?string, ownerRole: ?string, note: ?string, fixedTime: bool, showToGuests: bool, version: int} */
    public function item(ScheduleItem $item): array
    {
        $zone = new DateTimeZone($item->getEvent()->getTimeZone());

        return [
            'id' => $item->getId()->toRfc4122(),
            'title' => $item->getTitle(),
            'startsAt' => LocalTimeResolver::resolve($item->getStartsAt(), $zone)->format(\DATE_ATOM),
            'startedAt' => $item->getStartedAt()?->setTimezone($zone)->format(\DATE_ATOM),
            'endedAt' => $item->getEndedAt()?->setTimezone($zone)->format(\DATE_ATOM),
            'skipped' => $item->isSkipped(),
            'day' => EventDay::of($item->getStartsAt()),
            'lengthMinutes' => $item->getLengthMinutes(),
            'place' => $item->getPlace(),
            'ownerName' => $item->getOwnerName(),
            'ownerRole' => $item->getOwnerRole(),
            'note' => $item->getNote(),
            'fixedTime' => $item->isFixedTime(),
            'showToGuests' => $item->isShownToGuests(),
            'version' => $item->getVersion(),
        ];
    }
}
