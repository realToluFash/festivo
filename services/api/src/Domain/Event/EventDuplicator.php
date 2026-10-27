<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Domain\Event\Cover\EventCoverEditor;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use Doctrine\ORM\EntityManagerInterface;
use Throwable;

/** How an event is set up, never who is coming or what happened: a new Draft, as long as the original (sc-3593). */
final readonly class EventDuplicator
{
    public function __construct(
        private EventRules $eventRules,
        private EventCoverEditor $eventCoverEditor,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    /** `$startsAt` is local to the original's zone. The length is elapsed time, so a copy across a change of clocks ends an hour off the original's wall-clock end. */
    public function duplicate(Event $original, User $by, ?string $startsAt): Event
    {
        $start = $this->eventRules->startsAt($startsAt, $original->getTimeZone());
        $length = $original->getEndsAt()->getTimestamp() - $original->getStartsAt()->getTimestamp();

        $copy = new Event($original->getOrganisation(), $original->getName(), $original->getType(), $start, $start->setTimestamp($start->getTimestamp() + $length), $original->getCurrency());
        EventVenue::write($copy, EventVenue::of($original));
        $this->entityManager->persist($copy);
        $cover = $this->eventCoverEditor->copy($original, $copy);

        $this->auditor->record(EventCreator::CREATED, 'Event', $copy->getId(), Actor::User, $by->getId(), $by->getName(), [
            ...EventCreator::recorded($copy),
            ...Auditor::diff([], null === $cover ? [] : EventCoverEditor::recorded($cover)),
            'duplicatedFrom' => [null, $original->getId()->toRfc4122()],
        ]);

        try {
            $this->entityManager->flush();
        } catch (Throwable $failed) {
            if (null !== $cover) {
                $this->eventCoverEditor->unpublish($cover->getPhotoKey());
            }

            throw $failed;
        }

        return $copy;
    }
}
