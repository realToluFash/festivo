<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Briefing\Briefings;
use App\Domain\Staff\Briefing\HouseRulesEditor;
use App\Domain\Staff\Http\StaffSerialiser;
use App\Domain\Staff\Link\MyNight;
use App\Domain\Staff\Link\StaffLinks;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The briefing on the event's Staff page (sc-3917): house rules, Preview as, and each person's link copied and marked as sent by hand. Sending it waits for epic 36. */
final readonly class BriefingController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private Briefings $briefings,
        private HouseRulesEditor $houseRulesEditor,
        private StaffSerialiser $staffSerialiser,
        private StaffLinks $staffLinks,
        private MyNight $myNight,
    ) {
    }

    /** Answers the link with its plain token once, as the Link column's copy does; refused 409 `conflict` with no mobile number. */
    #[Route('/api/events/{eventId}/staff/{staffId}/briefing/link', name: 'staff_briefing_copy', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function copy(#[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $url = $this->briefings->copy($entry, $this->user());

        return new JsonResponse(['url' => $url, 'staff' => $this->staffSerialiser->entry($entry)]);
    }

    /** Refused 409 `conflict` before a copy from the briefing. */
    #[Route('/api/events/{eventId}/staff/{staffId}/briefing/sent', name: 'staff_briefing_mark_sent', methods: ['POST'])]
    #[InEvent(Permission::StaffManage)]
    public function markSent(#[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $this->briefings->markSent($entry, $this->user());

        return new JsonResponse(['staff' => $this->staffSerialiser->entry($entry)]);
    }

    /** Refused `validation_failed` on `rules` past 2,000 code points. */
    #[Route('/api/events/{eventId}/briefing/rules', name: 'staff_briefing_rules', methods: ['PUT'])]
    #[InEvent(Permission::StaffManage)]
    public function rules(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['rules' => Type\string()]));
        $this->houseRulesEditor->save($event, $body['rules'], $this->user());

        return new JsonResponse(['rules' => $event->getStaffRules()]);
    }

    /** The person's shift page as they would see it, recording nothing: no read and no link open. */
    #[Route('/api/events/{eventId}/staff/{staffId}/preview', name: 'staff_briefing_preview', methods: ['GET'])]
    #[InEvent(Permission::StaffRead)]
    public function preview(#[InThisEvent('staffId')] StaffMember $entry): JsonResponse
    {
        $until = $this->staffLinks->window($entry)->until ?? $entry->getEvent()->getEndsAt();

        return new JsonResponse($this->myNight->of($entry, $until));
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
