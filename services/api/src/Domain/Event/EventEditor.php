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
     * A type sent as null is refused like a missing one on create: an event, once typed, stays typed (sc-3588).
     *
     * @param array{name?: string, type?: ?string, startsAt?: string, endsAt?: string, timeZone?: string, currency?: string} $fields
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
                'type' => Iter\contains_key($fields, 'type') ? $fields['type'] : $event->getType()->value,
                'startsAt' => $fields['startsAt'] ?? $event->getStartsAt()->format('Y-m-d\TH:i:s'),
                'endsAt' => $fields['endsAt'] ?? $event->getEndsAt()->format('Y-m-d\TH:i:s'),
                'timeZone' => $fields['timeZone'] ?? $event->getTimeZone(),
                'currency' => $fields['currency'] ?? $event->getCurrency(),
            ], $event->getCurrency());

            if ($checked['currency'] !== $event->getCurrency() && $this->eventAmounts->anyRecordedFor($event)) {
                throw new ApiException(ErrorCode::EventCurrencyInUse, 'event.currency_in_use');
            }

            $event->setName($checked['name']);
            $event->setType($checked['type']);
            $event->setCurrency($checked['currency']);

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

    /** @return array{name: string, type: string, startsAt: string, endsAt: string, timeZone: string, currency: string} */
    private static function recorded(Event $event): array
    {
        return [
            'name' => $event->getName(),
            'type' => $event->getType()->value,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'currency' => $event->getCurrency(),
        ];
    }
}
