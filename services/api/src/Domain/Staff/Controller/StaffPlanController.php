<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\StaffPlan;
use App\Domain\Staff\StaffPlanRules;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\StaffAccess;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\StaffJobRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** An event's jobs and shifts, and who fills them (sc-3908). Every change answers the whole staff list, as the roster's topic publishes it. */
final readonly class StaffPlanController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private StaffJobRepository $staffJobRepository,
        private StaffPlan $staffPlan,
        private StaffPlanRules $staffPlanRules,
        private StaffSerialiser $staffSerialiser,
    ) {
    }

    /** Refused `validation_failed` on `name`. */
    #[Route('/api/events/{eventId}/staff/jobs', name: 'staff_job_add', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function addJob(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, self::jobShape());
        $this->staffPlan->addJob($event, $body['name'], $body['access'], $this->user());

        return $this->answered($event, Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/staff/jobs/{jobId}', name: 'staff_job_edit', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function editJob(Request $request, #[InThisEvent('jobId')] StaffJob $job): JsonResponse
    {
        $body = Input::body($request, self::jobShape());
        $this->staffPlan->editJob($job, $body['name'], $body['access'], $this->user());

        return $this->answered($job->getEvent(), Response::HTTP_OK);
    }

    /** Refused 409 `staff_job_worked` once anyone has clocked in on one of its shifts, else `staff_job_staffed` while anyone is on them. */
    #[Route('/api/events/{eventId}/staff/jobs/{jobId}', name: 'staff_job_remove', methods: ['DELETE'])]
    #[InEvent(Permission::StaffManage)]
    public function removeJob(#[InThisEvent('jobId')] StaffJob $job): JsonResponse
    {
        $event = $job->getEvent();
        $this->staffPlan->removeJob($job, $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** Times are wall-clock in the event's zone, `2026-11-07T16:00`. Refused `validation_failed` on each field at once. */
    #[Route('/api/events/{eventId}/staff/shifts', name: 'staff_shift_add', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function addShift(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'job' => Type\nullable(Type\string()),
            'startsAt' => Type\string(),
            'endsAt' => Type\string(),
            'needed' => Type\int(),
        ]));
        $job = null === $body['job'] || '' === $body['job'] ? null : $this->job($event, $body['job']);
        $details = $this->staffPlanRules->shift($event, null !== $job, $body['startsAt'], $body['endsAt'], $body['needed'], 0);

        if (null !== $job) {
            $this->staffPlan->addShift($job, $details, $this->user());
        }

        return $this->answered($event, Response::HTTP_CREATED);
    }

    /** Refused `validation_failed` naming `onShift` when People needed is below the people on it, and 409 `staff_shift_overlap` when a new overlap would appear. */
    #[Route('/api/events/{eventId}/staff/shifts/{shiftId}', name: 'staff_shift_edit', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function editShift(Request $request, #[InThisEvent('shiftId')] StaffShift $shift): JsonResponse
    {
        $event = $shift->getJob()->getEvent();
        $body = Input::body($request, Type\shape([
            'startsAt' => Type\string(),
            'endsAt' => Type\string(),
            'needed' => Type\int(),
        ]));
        $this->staffPlan->editShift($shift, $body['startsAt'], $body['endsAt'], $body['needed'], $this->user());

        return $this->answered($event, Response::HTTP_OK);
    }

    /** Refused 409 `staff_shift_full`, `staff_works_as` naming `job`, then `staff_shift_overlap` naming `shift`. */
    #[Route('/api/events/{eventId}/staff/shifts/{shiftId}/people/{staffId}', name: 'staff_shift_assign', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function assign(#[InThisEvent('shiftId')] StaffShift $shift, #[InThisEvent('staffId')] StaffMember $person): JsonResponse
    {
        $this->staffPlan->assign($shift, $person, $this->user());

        return $this->answered($shift->getJob()->getEvent(), Response::HTTP_OK);
    }

    /** Refused 409 `staff_shift_worked` once they have clocked in on it. */
    #[Route('/api/events/{eventId}/staff/shifts/{shiftId}/people/{staffId}', name: 'staff_shift_unassign', methods: ['DELETE'])]
    #[InEvent(Permission::StaffManage)]
    public function unassign(#[InThisEvent('shiftId')] StaffShift $shift, #[InThisEvent('staffId')] StaffMember $person): JsonResponse
    {
        $this->staffPlan->unassign($shift, $person, $this->user());

        return $this->answered($shift->getJob()->getEvent(), Response::HTTP_OK);
    }

    /** @return Type\TypeInterface<array{name: string, access: StaffAccess}> */
    private static function jobShape(): Type\TypeInterface
    {
        return Type\shape([
            'name' => Type\string(),
            'access' => Type\backed_enum(StaffAccess::class),
        ]);
    }

    private function answered(Event $event, int $status): JsonResponse
    {
        return new JsonResponse($this->staffSerialiser->list($event), $status);
    }

    private function job(Event $event, string $id): StaffJob
    {
        $job = Uuid::isValid($id) ? $this->staffJobRepository->findOneInEvent($event->getId(), Uuid::fromString($id)) : null;

        return $job ?? throw ApiException::notFound('access.not_found');
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
