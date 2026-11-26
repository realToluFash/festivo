<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Attendance\AttendanceCorrector;
use App\Domain\Staff\Http\StaffHoursSerialiser;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\ShiftAttendanceRepository;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Hours worked (sc-234): read by anybody who can see the event's staff, corrected only by a member who manages them. */
final readonly class StaffHoursController
{
    public function __construct(
        private Security $security,
        private StaffHoursSerialiser $staffHoursSerialiser,
        private AttendanceCorrector $attendanceCorrector,
        private EventRepository $eventRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
    ) {
    }

    #[Route('/api/events/{eventId}/staff/hours', name: 'staff_hours', methods: ['GET'])]
    #[InEvent(Permission::StaffRead)]
    public function list(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse($this->staffHoursSerialiser->page($event, $this->canCorrect($event)));
    }

    /** Refused `validation_failed` on `clockedInAt` or `clockedOutAt`, as the form checks them; 403 to a grant from outside and on the corrector's own shift. `staffId` is a row's, so it may be a person since removed from the roster. */
    #[Route('/api/events/{eventId}/staff/hours/{shiftId}/{staffId}', name: 'staff_hours_correct', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function correct(Request $request, #[InThisEvent('shiftId')] StaffShift $shift, string $staffId): JsonResponse
    {
        $who = Iter\search($shift->getPeople(), static fn (StaffMember $one): bool => $one->getId()->toRfc4122() === $staffId)
            ?? $this->shiftAttendanceRepository->findOneRemovedOn($shift, $staffId)
            ?? throw ApiException::notFound('access.not_found');
        $body = Input::body($request, Type\shape([
            'clockedInAt' => Type\string(),
            'clockedOutAt' => Type\nullable(Type\string()),
        ]));
        $this->attendanceCorrector->correct($shift, $who, $body['clockedInAt'], $body['clockedOutAt'], $this->user());
        $event = $shift->getJob()->getEvent();

        return new JsonResponse($this->staffHoursSerialiser->page($event, $this->canCorrect($event)));
    }

    private function canCorrect(Event $event): bool
    {
        return $this->attendanceCorrector->mayCorrect($this->user(), $event);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
