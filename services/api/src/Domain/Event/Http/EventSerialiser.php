<?php

declare(strict_types=1);

namespace App\Domain\Event\Http;

use App\Domain\Event\Cover\CoverPhotoProcessor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Event\EventDayCount;
use App\Entity\Event;
use App\Entity\EventCover;
use App\Repository\EventCoverRepository;
use App\Storage\ObjectStore;
use DateTimeZone;
use Psl\Vec;

final readonly class EventSerialiser
{
    public function __construct(
        private EventCoverRepository $eventCoverRepository,
        private ObjectStore $objectStore,
    ) {
    }

    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, createdAt: string} */
    public function event(Event $event): array
    {
        return $this->serialise($event, $this->eventCoverRepository->findOneForEvent($event));
    }

    /**
     * @param list<Event> $events
     *
     * @return list<array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, createdAt: string}>
     */
    public function events(array $events): array
    {
        $covers = $this->eventCoverRepository->findForEvents($events);

        return Vec\map($events, fn (Event $event): array => $this->serialise($event, $covers[$event->getId()->toRfc4122()] ?? null));
    }

    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, createdAt: string} */
    private function serialise(Event $event, ?EventCover $cover): array
    {
        return [
            'id' => $event->getId()->toRfc4122(),
            'organisationId' => $event->getOrganisation()->getId()->toRfc4122(),
            'name' => $event->getName(),
            'type' => $event->getType()->value,
            'status' => $event->getStatus()->value,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'dayCount' => EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), new DateTimeZone($event->getTimeZone())),
            'currency' => $event->getCurrency(),
            'cover' => null === $cover ? null : $this->cover($cover),
            'createdAt' => $event->getCreatedAt()->format(\DATE_ATOM),
        ];
    }

    /** @return array{position: int, description: ?string, sizes: list<array{width: int, url: string}>} */
    private function cover(EventCover $cover): array
    {
        $sizes = [];
        foreach (CoverPhotoProcessor::SIZES as $size => $width) {
            $sizes[] = ['width' => $width, 'url' => $this->objectStore->publicUrl(EventCoverEditor::sizeKey($cover->getPhotoKey(), $size))];
        }

        return [
            'position' => $cover->getPosition(),
            'description' => $cover->getDescription(),
            'sizes' => $sizes,
        ];
    }
}
