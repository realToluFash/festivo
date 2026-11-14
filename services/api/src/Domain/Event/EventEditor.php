<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Domain\Messaging\EventChanges\EventChangeRecorder;
use App\Domain\Messaging\Model\EventDetails;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventAction;
use App\Enum\EventPhase;
use App\Enum\EventStatus;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class EventEditor
{
    public const string UPDATED = 'event.updated';

    private const array SCHEDULE = ['startsAt', 'endsAt', 'timeZone'];

    public function __construct(
        private EventRules $eventRules,
        private EventAmounts $eventAmounts,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
        private NotificationScheduler $notificationScheduler,
        private EventChangeRecorder $eventChangeRecorder,
    ) {
    }

    /**
     * A field left out keeps its value. Start and end are wall-clock times, so a new zone alone keeps them as typed.
     *
     * A type sent as null is refused like a missing one on create: an event, once typed, stays typed (sc-3588).
     * `hosts` replaces the whole list, and an event made live keeps at least one (sc-6713).
     *
     * @param array{name?: string, type?: ?string, startsAt?: string, endsAt?: string, timeZone?: string, currency?: string, venue?: array{name?: ?string, address?: ?string, addressId?: ?string}|null, hosts?: list<string>} $fields
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
            $details = EventDetails::of($event);
            $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now());
            $checked = $this->eventRules->check([
                'name' => $fields['name'] ?? $event->getName(),
                'type' => Iter\contains_key($fields, 'type') ? $fields['type'] : $event->getType()->value,
                'startsAt' => $fields['startsAt'] ?? $event->getStartsAt()->format('Y-m-d\TH:i:s'),
                'endsAt' => $fields['endsAt'] ?? $event->getEndsAt()->format('Y-m-d\TH:i:s'),
                'timeZone' => $fields['timeZone'] ?? $event->getTimeZone(),
                'currency' => $fields['currency'] ?? $event->getCurrency(),
                ...Iter\contains_key($fields, 'venue') ? ['venue' => $fields['venue']] : [],
                ...Iter\contains_key($fields, 'hosts') ? ['hosts' => $fields['hosts']] : [],
            ], $event->getCurrency(), EventVenue::of($event));

            if ($checked['currency'] !== $event->getCurrency() && $this->eventAmounts->anyRecordedFor($event)) {
                throw new ApiException(ErrorCode::EventCurrencyInUse, 'event.currency_in_use');
            }

            $event->setName($checked['name']);
            $event->setType($checked['type']);
            $event->setCurrency($checked['currency']);

            if (Iter\contains_key($checked, 'venue')) {
                EventVenue::write($event, $checked['venue']);
            }

            if (Iter\contains_key($checked, 'hosts')) {
                if ([] === $checked['hosts'] && [] !== $event->getHosts() && EventStatus::Draft !== $event->getStatus()) {
                    throw new ApiException(ErrorCode::EventHostRequired, $this->translator->trans('event.last_host'));
                }

                $event->setHosts($checked['hosts']);
            }

            $schedule = [$checked['startsAt']->format(\DATE_ATOM), $checked['endsAt']->format(\DATE_ATOM), $checked['startsAt']->getTimezone()->getName()];

            if ($schedule !== [$before['startsAt'], $before['endsAt'], $before['timeZone']]) {
                $event->setTimes($checked['startsAt'], $checked['endsAt']);

                if ($schedule[2] === $before['timeZone']) {
                    $this->notificationScheduler->rescheduleForEvent($event);
                } else {
                    $this->notificationScheduler->rescheduleForNewZone($event);
                }
            }

            $changes = Auditor::diff($before, self::recorded($event));
            $this->allow($phase, $changes);

            if ([] !== $changes) {
                $this->auditor->record(self::UPDATED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
                $this->eventChangeRecorder->edited($event, $by, $details, EventDetails::of($event));
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
            'type' => $event->getType()->value,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'currency' => $event->getCurrency(),
            ...self::venueRecorded($event),
            'hosts' => $event->getHosts(),
        ];
    }

    /**
     * A change to the start, end or zone needs `edit_schedule`, and to anything else `edit`: a save of both needs both.
     *
     * @param list<string> $changed
     *
     * @return list<EventAction>
     */
    public static function actionsFor(array $changed): array
    {
        $schedule = Vec\filter($changed, static fn (string $field): bool => Iter\contains(self::SCHEDULE, $field));

        return [
            ...[] === $schedule ? [] : [EventAction::EditSchedule],
            ...Iter\count($schedule) === Iter\count($changed) ? [] : [EventAction::Edit],
        ];
    }

    /** @param array<string, mixed> $changes */
    private function allow(EventPhase $phase, array $changes): void
    {
        foreach (self::actionsFor(Vec\keys($changes)) as $action) {
            if (EventPhase::Finished === $phase && EventAction::EditSchedule === $action) {
                throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('event.schedule_concluded'));
            }

            if (!$phase->allows($action)) {
                throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: ['phase' => $phase->value]);
            }
        }
    }
}
