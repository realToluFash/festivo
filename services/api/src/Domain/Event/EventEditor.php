<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;

final readonly class EventEditor
{
    public const string UPDATED = 'event.updated';

    public function __construct(
        private EventRules $eventRules,
        private EventAmounts $eventAmounts,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    /**
     * A field left out keeps its value. Start and end are wall-clock times, so a new zone alone keeps them as typed.
     *
     * @param array{name?: string, startsAt?: string, endsAt?: string, timeZone?: string, currency?: string, venue?: array{name?: ?string, address?: ?string, addressId?: ?string}|null} $fields
     */
    public function edit(Event $event, ?string $ifMatch, User $by, array $fields): Event
    {
        if (null === $ifMatch || '*' === Str\trim($ifMatch)) {
            throw new ApiException(ErrorCode::PreconditionRequired, 'event.version_required');
        }

        return $this->entityManager->wrapInTransaction(function () use ($event, $ifMatch, $by, $fields): Event {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (!EntityTag::matches($ifMatch, EntityTag::of($event->getVersion()))) {
                throw new ApiException(ErrorCode::PreconditionFailed, 'event.changed_since');
            }

            $before = self::recorded($event);
            $checked = $this->eventRules->check([
                'name' => $fields['name'] ?? $event->getName(),
                'startsAt' => $fields['startsAt'] ?? $event->getStartsAt()->format('Y-m-d\TH:i:s'),
                'endsAt' => $fields['endsAt'] ?? $event->getEndsAt()->format('Y-m-d\TH:i:s'),
                'timeZone' => $fields['timeZone'] ?? $event->getTimeZone(),
                'currency' => $fields['currency'] ?? $event->getCurrency(),
                ...Iter\contains_key($fields, 'venue') ? ['venue' => $fields['venue']] : [],
            ], $event->getCurrency(), EventVenue::of($event));

            if ($checked['currency'] !== $event->getCurrency() && $this->eventAmounts->anyRecordedFor($event)) {
                throw new ApiException(ErrorCode::EventCurrencyInUse, 'event.currency_in_use');
            }

            $event->setName($checked['name']);
            $event->setCurrency($checked['currency']);

            if (Iter\contains_key($checked, 'venue')) {
                EventVenue::write($event, $checked['venue']);
            }

            $schedule = [$checked['startsAt']->format(\DATE_ATOM), $checked['endsAt']->format(\DATE_ATOM), $checked['startsAt']->getTimezone()->getName()];

            if ($schedule !== [$before['startsAt'], $before['endsAt'], $before['timeZone']]) {
                $event->setTimes($checked['startsAt'], $checked['endsAt']);
            }

            $changes = Auditor::diff($before, self::recorded($event));

            if ([] !== $changes) {
                $this->auditor->record(self::UPDATED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
                $this->entityManager->flush();
            }

            return $event;
        });
    }

    /**
     * What the audit log keeps of a venue: its name, its line, and where it is when that is known.
     *
     * @return array{venueName: ?string, venueAddress: ?string, venueCountryCode: ?string, venueCoordinates: ?array{float, float}}
     */
    public static function venueRecorded(Event $event): array
    {
        $venue = EventVenue::of($event);
        $address = $venue?->address;

        return [
            'venueName' => $venue?->name,
            'venueAddress' => $address?->formatted,
            'venueCountryCode' => $address?->countryCode,
            'venueCoordinates' => null === $address?->latitude || null === $address->longitude ? null : [$address->latitude, $address->longitude],
        ];
    }

    /** @return array<string, mixed> */
    private static function recorded(Event $event): array
    {
        return [
            'name' => $event->getName(),
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'currency' => $event->getCurrency(),
            ...self::venueRecorded($event),
        ];
    }
}
