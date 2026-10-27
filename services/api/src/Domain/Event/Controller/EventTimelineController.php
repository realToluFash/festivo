<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\Timeline\EventTimeline;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use DateTimeZone;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class EventTimelineController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private EventTimeline $eventTimeline,
    ) {
    }

    /** Every milestone the reader's role lets them see, earliest first, at the offset in force in the event's zone (sc-3624). */
    #[Route('/api/events/{eventId}/timeline', name: 'events_timeline', methods: ['GET'])]
    #[InEvent(Permission::EventsRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');
        $grants = $this->membershipDirectory->grantsIn($this->user(), $event->getOrganisation()->getId()) ?? throw ApiException::notFound('access.not_found');
        $zone = new DateTimeZone($event->getTimeZone());

        return new JsonResponse([
            'timeZone' => $event->getTimeZone(),
            'milestones' => Vec\map($this->eventTimeline->of($event, $grants), static fn (Milestone $milestone): array => [
                'at' => $milestone->at->setTimezone($zone)->format(\DATE_ATOM),
                'title' => $milestone->title,
                'note' => $milestone->note,
                'owner' => $milestone->owner->value,
                'area' => $milestone->area->value,
                'action' => null === $milestone->action ? null : ['label' => $milestone->action->label, 'link' => $milestone->action->link],
            ]),
        ]);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
