<?php

declare(strict_types=1);

namespace App\Domain\Event\Deletion;

use App\Audit\Auditor;
use App\Deletion\RestoreWindow;
use App\Deletion\TypedName;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\EventStatus;
use App\Http\Exception\ApiException;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Deletes an event for everybody (sc-3592). Only the event's row is marked, so a restore brings back what lay beneath it as it was. */
final readonly class EventDeleter
{
    public const string DELETED = 'event.deleted';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** A Draft loses nothing anybody else has seen, so only the others ask for the name typed. */
    public static function needsName(Event $event): bool
    {
        return EventStatus::Draft !== $event->getStatus();
    }

    public function delete(Event $event, User $by, ?string $typedName): DateTimeImmutable
    {
        if (self::needsName($event) && !TypedName::matches($typedName ?? '', $event->getName())) {
            throw ApiException::validation([[
                'propertyPath' => 'name',
                'message' => $this->translator->trans('event.delete_name_mismatch', ['{name}' => $event->getName()]),
                'code' => 'event_name_mismatch',
            ]]);
        }

        $at = RestoreWindow::toTheSecond($this->clock->now());
        $event->setDeletedAt($at);
        $event->setDeletedBy($by->getId());
        $this->auditor->record(self::DELETED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
            'name' => [$event->getName(), null],
            'deletedAt' => [null, $at->format(\DATE_ATOM)],
        ]);
        $this->entityManager->flush();

        return $at;
    }
}
