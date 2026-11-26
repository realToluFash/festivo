<?php

declare(strict_types=1);

namespace App\Domain\Staff\Controller;

use App\Domain\Staff\Attendance\ClockWindow;
use App\Domain\Staff\Link\StaffLinks;
use App\Domain\Staff\Station\StationPlan;
use App\Domain\Staff\WhosHere\Model\WhosHereView;
use App\Domain\Staff\WhosHere\WalkOns;
use App\Domain\Staff\WhosHere\WhosHereAccess;
use App\Domain\Staff\WhosHere\WhosHereReader;
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
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use Psl\Iter;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Who's here (sc-3918): the floor lead's and the station leads' view of who has clocked in, read by staff.read and by those leads for their own people, whatever their level. */
final readonly class WhosHereController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private StaffMemberRepository $staffMemberRepository,
        private StaffShiftRepository $staffShiftRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private WhosHereAccess $whosHereAccess,
        private WhosHereReader $whosHereReader,
        private WalkOns $walkOns,
        private StaffLinks $staffLinks,
        private StationPlan $stationPlan,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
        private ClockInterface $clock,
    ) {
    }

    #[Route('/api/events/{eventId}/whos-here', name: 'whos_here', methods: ['GET'])]
    #[InEvent(Permission::EventsRead)]
    public function read(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);

        return new JsonResponse($this->whosHereReader->read($event, $this->view($event)));
    }

    /** Someone's at the door. `url` is their link, answered once, when a mobile number was given; `station` is ignored for a station lead. */
    #[Route('/api/events/{eventId}/whos-here/walk-ons', name: 'whos_here_walk_on', methods: ['POST'])]
    #[InEvent(Permission::EventsRead)]
    public function walkOn(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'fullName' => Type\string(),
            'mobile' => Type\optional(Type\nullable(self::mobileShape())),
            'job' => Type\optional(Type\nullable(Type\string())),
            'station' => Type\optional(Type\nullable(Type\string())),
        ]));
        $view = $this->view($event);
        $entry = $this->walkOns->add($event, $view, $body['fullName'], $body['mobile'] ?? null, $body['job'] ?? null, $body['station'] ?? null);

        return new JsonResponse($this->linked($entry, $view), Response::HTTP_CREATED);
    }

    /** Add a mobile number, for staff.manage and for the lead who added that walk-on; answers their link to copy. */
    #[Route('/api/events/{eventId}/whos-here/people/{staffId}/mobile', name: 'whos_here_mobile', methods: ['PUT'])]
    #[InEvent(Permission::EventsRead)]
    public function mobile(Request $request, #[InThisEvent('staffId')] StaffMember $person): JsonResponse
    {
        $body = Input::body($request, Type\shape(['mobile' => self::mobileShape()]));
        $view = $this->view($person->getEvent());

        if (!WhosHereAccess::shows($view, $person)) {
            throw ApiException::permissionRequired(Permission::StaffManage);
        }

        $this->walkOns->setMobile($view, $person, $body['mobile']);

        return new JsonResponse($this->linked($person, $view));
    }

    /** Cover {station}: the floor lead's and staff.manage's only. Refused `validation_failed` on `mover` for someone not clocked in or already on that station. */
    #[Route('/api/events/{eventId}/whos-here/cover', name: 'whos_here_cover', methods: ['POST'])]
    #[InEvent(Permission::EventsRead)]
    public function cover(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $view = $this->view($event);

        if (!$view->canCover) {
            throw ApiException::permissionRequired(Permission::StaffManage);
        }

        $body = Input::body($request, Type\shape(['absent' => Type\string(), 'mover' => Type\string()]));
        $absent = $this->staffMember($event, $body['absent']);
        $mover = $this->staffMember($event, $body['mover']);

        if (!$this->isHere($mover)) {
            throw ApiException::validation([[
                'propertyPath' => 'mover',
                'message' => 'whos_here.cover_not_here',
                'code' => ErrorCode::ValidationFailed->value,
                'parameters' => [],
            ]]);
        }

        $this->stationPlan->cover($absent, $mover, $view->reader);

        return new JsonResponse($this->whosHereReader->read($event, $view));
    }

    /** A hub token for Who's here's signal to read again, for anybody who may read it. */
    #[Route('/api/events/{eventId}/whos-here/subscriptions', name: 'whos_here_subscribe', methods: ['POST'])]
    #[InEvent(Permission::EventsRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->view($event);
        $issued = $this->subscriberTokenIssuer->issueForEventWhosHere($event->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    /** @return Type\TypeInterface<array{countryCode: string, number: string}> */
    private static function mobileShape(): Type\TypeInterface
    {
        return Type\shape(['countryCode' => Type\string(), 'number' => Type\string()]);
    }

    /** @return array{staff: array{id: string, name: string}, url: ?string, phone: ?string} */
    private function linked(StaffMember $entry, WhosHereView $view): array
    {
        $phone = $entry->getMobile();

        return [
            'staff' => ['id' => $entry->getId()->toRfc4122(), 'name' => $entry->getFullName()],
            'url' => null === $phone ? null : $this->staffLinks->deliver($entry, $view->reader),
            'phone' => $phone,
        ];
    }

    private function isHere(StaffMember $person): bool
    {
        $now = $this->clock->now();

        return Iter\any(
            $this->staffShiftRepository->findOfPerson($person),
            fn (StaffShift $shift): bool => ClockWindow::stillOn($shift, $this->shiftAttendanceRepository->findOneOn($shift, $person), $now),
        );
    }

    private function view(Event $event): WhosHereView
    {
        return $this->whosHereAccess->viewOf($this->user(), $event);
    }

    private function staffMember(Event $event, string $id): StaffMember
    {
        $person = Uuid::isValid($id) ? $this->staffMemberRepository->findOneInEvent($event->getId(), Uuid::fromString($id)) : null;

        return $person ?? throw ApiException::notFound('access.not_found');
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
