<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Domain\Event\Model\Duplicate;
use App\Domain\Guest\GuestListCopier;
use App\Domain\Seating\SeatingPlanCopier;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use Throwable;

/** How an event is set up, never what happened: a new Draft, as long as the original (sc-3593), with its guests only when asked (sc-3656). */
final readonly class EventDuplicator
{
    public function __construct(
        private EventRules $eventRules,
        private EventCoverEditor $eventCoverEditor,
        private SeatingPlanCopier $seatingPlanCopier,
        private GuestListCopier $guestListCopier,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    /** `$startsAt` is local to the original's zone. The length is read on the clock, not in elapsed time, so a change of clocks on either night moves neither end. */
    public function duplicate(Event $original, User $by, ?string $startsAt, bool $copyGuests = false): Duplicate
    {
        $zone = new DateTimeZone($original->getTimeZone());
        $start = $this->eventRules->startsAt($startsAt, $original->getTimeZone());
        $length = self::wallClock($original->getEndsAt())->getTimestamp() - self::wallClock($original->getStartsAt())->getTimestamp();
        $end = self::wallClock($start);

        $copy = new Event($original->getOrganisation(), $original->getName(), $original->getType(), $start, LocalTimeResolver::resolve($end->setTimestamp($end->getTimestamp() + $length), $zone), $original->getCurrency());
        EventVenue::write($copy, EventVenue::of($original));
        $this->entityManager->persist($copy);
        $cover = $this->eventCoverEditor->copy($original, $copy);
        $this->seatingPlanCopier->copy($original, $copy, $by);
        $guestsCopied = $copyGuests ? $this->guestListCopier->copy($original, $copy, $by) : null;

        $this->auditor->record(EventCreator::CREATED, 'Event', $copy->getId(), Actor::User, $by->getId(), $by->getName(), [
            ...EventCreator::recorded($copy),
            ...Auditor::diff([], null === $cover ? [] : EventCoverEditor::recorded($cover)),
            'duplicatedFrom' => [null, $original->getId()->toRfc4122()],
            ...(null === $guestsCopied ? [] : ['guestsCopied' => [null, $guestsCopied]]),
        ]);

        try {
            $this->entityManager->flush();
        } catch (Throwable $failed) {
            if (null !== $cover) {
                $this->eventCoverEditor->unpublish($cover->getPhotoKey());
            }

            throw $failed;
        }

        return new Duplicate($copy, $guestsCopied);
    }

    private static function wallClock(DateTimeImmutable $zoned): DateTimeImmutable
    {
        return new DateTimeImmutable($zoned->format('Y-m-d H:i:s'), new DateTimeZone('UTC'));
    }
}
