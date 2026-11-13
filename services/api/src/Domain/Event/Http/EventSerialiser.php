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
use App\Enum\EventPhase;
use App\Enum\Permission;
use App\Http\Access\EventScope;
use App\Http\Access\Grants;
use App\Repository\EventCoverRepository;
use App\Storage\ObjectStore;
use DateTimeZone;
use Psl\Vec;
use Psr\Clock\ClockInterface;

final readonly class EventSerialiser
{
    public function __construct(
        private EventCoverRepository $eventCoverRepository,
        private ObjectStore $objectStore,
        private ClockInterface $clock,
    ) {
    }

    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, arrivalNote: ?string, hosts: list<string>, madeLiveAt: ?string, pausedAt: ?string, phase: string, concludedAt: ?string, createdAt: string, permissions: list<string>} */
    public function event(Event $event, Grants $grants): array
    {
        return $this->serialise($event, $this->eventCoverRepository->findOneForEvent($event), $grants);
    }

    /**
     * @param list<Event> $events
     *
     * @return list<array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, arrivalNote: ?string, hosts: list<string>, madeLiveAt: ?string, pausedAt: ?string, phase: string, concludedAt: ?string, createdAt: string, permissions: list<string>}>
     */
    public function events(array $events, EventScope $scope): array
    {
        $covers = $this->eventCoverRepository->findForEvents($events);

        return Vec\map($events, fn (Event $event): array => $this->serialise($event, $covers[$event->getId()->toRfc4122()] ?? null, $scope->on($event->getId()) ?? Grants::only([])));
    }

    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, cover: ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>}, venue: ?array{name: ?string, address: ?array{formatted: string, line1: ?string, line2: ?string, city: ?string, region: ?string, postalCode: ?string, countryCode: ?string, latitude: ?float, longitude: ?float}}, arrivalNote: ?string, hosts: list<string>, madeLiveAt: ?string, pausedAt: ?string, phase: string, concludedAt: ?string, createdAt: string, permissions: list<string>} */
    private function serialise(Event $event, ?EventCover $cover, Grants $grants): array
    {
        $venue = EventVenue::of($event);
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now());
        $zone = new DateTimeZone($event->getTimeZone());

        return [
            'id' => $event->getId()->toRfc4122(),
            'organisationId' => $event->getOrganisation()->getId()->toRfc4122(),
            'name' => $event->getName(),
            'type' => $event->getType()->value,
            'status' => $event->getStatus()->value,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'dayCount' => EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), $zone),
            'currency' => $event->getCurrency(),
            'cover' => null === $cover ? null : $this->cover($cover),
            'venue' => null === $venue ? null : ['name' => $venue->name, 'address' => null === $venue->address ? null : $this->address($venue->address)],
            'arrivalNote' => $event->getArrivalNote(),
            'hosts' => $event->getHosts(),
            'madeLiveAt' => $event->getMadeLiveAt()?->format(\DATE_ATOM),
            'pausedAt' => EventPhase::Paused === $phase ? $event->getPausedAt()?->format(\DATE_ATOM) : null,
            'phase' => $phase->value,
            'concludedAt' => EventPhase::Finished === $phase ? ($event->getEndedAt()?->setTimezone($zone) ?? $event->getEndsAt())->format(\DATE_ATOM) : null,
            'createdAt' => $event->getCreatedAt()->format(\DATE_ATOM),
            // What the caller may do on this event: a Member's come from their role on it, not from the organisation (sc-29915).
            'permissions' => Vec\map(Vec\filter(Permission::cases(), $grants->allows(...)), static fn (Permission $permission): string => $permission->value),
        ];
    }

    /** The cover as the event's page has it, for a page that shows nothing else of the event (sc-1526). @return ?array{position: int, description: ?string, sizes: list<array{width: int, url: string}>} */
    public function coverOf(Event $event): ?array
    {
        $cover = $this->eventCoverRepository->findOneForEvent($event);

        return null === $cover ? null : $this->cover($cover);
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
