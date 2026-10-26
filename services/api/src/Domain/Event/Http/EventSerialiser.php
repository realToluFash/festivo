<?php

declare(strict_types=1);

namespace App\Domain\Event\Http;

use App\Address\Model\Address;
use App\Domain\Event\Cover\CoverPhotoProcessor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Event\EventDayCount;
use App\Domain\Event\EventVenue;
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

    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, madeLiveAt: ?string, createdAt: string} */
    public function event(Event $event): array
    {
        return $this->serialise($event, $this->eventCoverRepository->findOneForEvent($event));
    }

    /**
     * @param list<Event> $events
     *
     * @return list<array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, madeLiveAt: ?string, createdAt: string}>
     */
    public function events(array $events): array
    {
        $covers = $this->eventCoverRepository->findForEvents($events);

        return Vec\map($events, fn (Event $event): array => $this->serialise($event, $covers[$event->getId()->toRfc4122()] ?? null));
    }

    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, madeLiveAt: ?string, createdAt: string} */
    private function serialise(Event $event, ?EventCover $cover): array
    {
        $venue = EventVenue::of($event);

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
            'venue' => null === $venue ? null : ['name' => $venue->name, 'address' => null === $venue->address ? null : $this->address($venue->address)],
            'madeLiveAt' => $event->getMadeLiveAt()?->format(\DATE_ATOM),
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

    /** @return array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float} */
    private function address(Address $address): array
    {
        return [
            'formatted' => $address->formatted,
            'line1' => $address->line1,
            'line2' => $address->line2,
            'city' => $address->city,
            'region' => $address->region,
            'postalCode' => $address->postalCode,
            'countryCode' => $address->countryCode,
            'latitude' => $address->latitude,
            'longitude' => $address->longitude,
        ];
    }
}
