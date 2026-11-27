<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\ShiftNotice\ShiftReminders;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The staffing page's Reminder the day before (sc-4333). */
final readonly class ShiftReminderController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private ShiftReminders $shiftReminders,
    ) {
    }

    #[Route('/api/events/{eventId}/staff/reminder', name: 'staff_reminder', methods: ['GET'])]
    #[InEvent(Permission::StaffRead)]
    public function show(string $eventId): JsonResponse
    {
        return new JsonResponse($this->shiftReminders->card($this->event($eventId)));
    }

    /** Refused 409 `event_concluded` once the event is Finished. */
    #[Route('/api/events/{eventId}/staff/reminder', name: 'staff_reminder_switch', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function switch(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['on' => Type\bool()]));
        $this->shiftReminders->switch($event, $body['on'], $this->user());

        return new JsonResponse($this->shiftReminders->card($event));
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
