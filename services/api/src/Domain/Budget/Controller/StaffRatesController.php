<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\StaffRatesSerialiser;
use App\Domain\Budget\StaffRateEditor;
use App\Domain\Budget\StaffRateRules;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Budget / Staff rates (sc-101): budget.read sees each job's rate and the people on their own, budget.manage sets them. Every change answers with the whole page. */
final readonly class StaffRatesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private StaffRateEditor $staffRateEditor,
        private StaffRateRules $staffRateRules,
        private StaffRatesSerialiser $staffRatesSerialiser,
    ) {
    }

    #[Route('/api/events/{eventId}/budget/staff-rates', name: 'budget_staff_rates', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function show(string $eventId): JsonResponse
    {
        return new JsonResponse($this->staffRatesSerialiser->page($this->event($eventId)));
    }

    /** `kind` hourly or flat, `amount` an hour or for each person, `currency` the event's. */
    #[Route('/api/events/{eventId}/budget/staff-rates/jobs/{jobId}', name: 'budget_staff_rate_job_set', methods: ['PUT'])]
    #[InEvent(Permission::BudgetManage)]
    public function setForJob(Request $request, #[InThisEvent('jobId')] StaffJob $job): JsonResponse
    {
        $rate = $this->staffRateRules->rate(Input::body($request, StaffRateRules::sent()), $job->getEvent()->getCurrency());
        $this->staffRateEditor->setForJob($job, $rate, $this->user());

        return new JsonResponse($this->staffRatesSerialiser->page($job->getEvent()));
    }

    /** Back to No rate yet: its hours are not counted until it has one. */
    #[Route('/api/events/{eventId}/budget/staff-rates/jobs/{jobId}', name: 'budget_staff_rate_job_remove', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage)]
    public function removeForJob(#[InThisEvent('jobId')] StaffJob $job): JsonResponse
    {
        $this->staffRateEditor->removeForJob($job, $this->user());

        return new JsonResponse($this->staffRatesSerialiser->page($job->getEvent()));
    }

    /** A person's own rate instead of their job's; refused while they have no job. */
    #[Route('/api/events/{eventId}/budget/staff-rates/people/{memberId}', name: 'budget_staff_rate_person_set', methods: ['PUT'])]
    #[InEvent(Permission::BudgetManage)]
    public function setForPerson(Request $request, #[InThisEvent('memberId')] StaffMember $person): JsonResponse
    {
        $rate = $this->staffRateRules->rate(Input::body($request, StaffRateRules::sent()), $person->getEvent()->getCurrency());
        $this->staffRateEditor->setForPerson($person, $rate, $this->user());

        return new JsonResponse($this->staffRatesSerialiser->page($person->getEvent()));
    }

    /** Back on their job's rate. */
    #[Route('/api/events/{eventId}/budget/staff-rates/people/{memberId}', name: 'budget_staff_rate_person_remove', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage)]
    public function removeForPerson(#[InThisEvent('memberId')] StaffMember $person): JsonResponse
    {
        $this->staffRateEditor->removeForPerson($person, $this->user());

        return new JsonResponse($this->staffRatesSerialiser->page($person->getEvent()));
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
