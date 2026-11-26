<?php

declare(strict_types=1);

namespace App\Domain\Service\Controller;

use App\Domain\Service\Model\Expected;
use App\Domain\Service\ServiceRead;
use App\Domain\Service\ServiceSteps;
use App\Domain\Service\ServiceTaps;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\ServicePlate;
use App\Entity\ServiceTray;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\HeldChoice;
use App\Enum\ItemMark;
use App\Enum\ItemState;
use App\Enum\Permission;
use App\Enum\PlateStage;
use App\Enum\SentBackReason;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use App\Repository\ServicePlateRepository;
use App\Repository\ServiceTrayRepository;
use Closure;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** A service (sc-4005): one read per course, and the steps that move plates. Each write answers the course's read as the caller sees it, and carries a key and what its tap saw (sc-4028). */
final readonly class ServiceController
{
    public function __construct(
        private Security $security,
        private MembershipDirectoryInterface $membershipDirectory,
        private EventRepository $eventRepository,
        private ServicePlateRepository $servicePlateRepository,
        private ServiceTrayRepository $serviceTrayRepository,
        private ServiceRead $serviceRead,
        private ServiceSteps $serviceSteps,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
        private ServiceTaps $serviceTaps,
    ) {
    }

    #[Route('/api/events/{eventId}/service/course/{courseId}', name: 'service_read', methods: ['GET'])]
    #[InEvent(Permission::ServiceWork)]
    public function read(#[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        return $this->answered($course);
    }

    #[Route('/api/events/{eventId}/service/subscriptions', name: 'service_subscribe', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventService($this->event($eventId)->getId());

        return new JsonResponse(['token' => $issued->token, 'expiresAt' => $issued->expiresAt->format(\DATE_ATOM)]);
    }

    /** `readyIn` is 5, 10, 15 or null, and only with `preparing`. */
    #[Route('/api/events/{eventId}/service/course/{courseId}/items', name: 'service_item', methods: ['PUT'])]
    #[InEvent(Permission::ServiceWork)]
    public function item(Request $request, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        return $this->tapped($request, $course->getEvent(), function () use ($request, $course): JsonResponse {
            $body = Input::body($request, Type\shape(['item' => Type\string(), 'state' => Type\backed_enum(ItemState::class), 'readyIn' => Type\optional(Type\nullable(Type\int())), 'expected' => self::expectedShape()]));
            $this->serviceSteps->markItem($course, $body['item'], $body['state'], $body['readyIn'] ?? null, self::expected($body, 'item'), $this->grants($course->getEvent()), $this->user());

            return $this->answered($course);
        });
    }

    #[Route('/api/events/{eventId}/service/plates/{plateId}/choice', name: 'service_choice', methods: ['PUT'])]
    #[InEvent(Permission::ServiceWork)]
    public function choice(Request $request, string $eventId, string $plateId): JsonResponse
    {
        $plate = $this->plate($eventId, $plateId);

        return $this->tapped($request, $plate->getEvent(), function () use ($request, $plate): JsonResponse {
            $body = Input::body($request, Type\shape(['choice' => Type\backed_enum(HeldChoice::class), 'expected' => self::expectedShape()]));
            $this->serviceSteps->choose($plate, $body['choice'], self::expected($body, 'plates'), $this->grants($plate->getEvent()), $this->user());

            return $this->answered($plate->getCourse());
        });
    }

    /** `table` is a table's key from the read. */
    #[Route('/api/events/{eventId}/service/course/{courseId}/trays', name: 'service_tray_start', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function start(Request $request, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        $body = Input::body($request, Type\shape(['table' => Type\string()]));
        $tray = $this->serviceSteps->start($course, $body['table'], $this->grants($course->getEvent()), $this->user());

        return $this->answered($course, Response::HTTP_CREATED, ['trayId' => $tray->getId()->toRfc4122()]);
    }

    /** `mark` is on, notOn, bringAfter, or null to clear it. */
    #[Route('/api/events/{eventId}/service/trays/{trayId}/marks', name: 'service_tray_mark', methods: ['PUT'])]
    #[InEvent(Permission::ServiceWork)]
    public function mark(Request $request, string $eventId, string $trayId): JsonResponse
    {
        $tray = $this->tray($eventId, $trayId);

        return $this->tapped($request, $tray->getEvent(), function () use ($request, $eventId, $tray): JsonResponse {
            $body = Input::body($request, Type\shape(['plateId' => Type\string(), 'item' => Type\string(), 'mark' => Type\nullable(Type\backed_enum(ItemMark::class)), 'expected' => self::expectedShape()]));
            $this->serviceSteps->mark($tray, $this->plate($eventId, $body['plateId']), $body['item'], $body['mark'], self::expected($body, 'plates'), $this->grants($tray->getEvent()), $this->user());

            return $this->answered($tray->getCourse());
        });
    }

    #[Route('/api/events/{eventId}/service/trays/{trayId}/check', name: 'service_tray_check', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function check(Request $request, string $eventId, string $trayId): JsonResponse
    {
        $tray = $this->tray($eventId, $trayId);

        return $this->tapped($request, $tray->getEvent(), function () use ($request, $tray): JsonResponse {
            $this->serviceSteps->check($tray, self::expected(self::expectedBody($request), 'plates'), $this->grants($tray->getEvent()), $this->user());

            return $this->answered($tray->getCourse());
        });
    }

    #[Route('/api/events/{eventId}/service/trays/{trayId}/plates/{plateId}', name: 'service_tray_take_off', methods: ['DELETE'])]
    #[InEvent(Permission::ServiceWork)]
    public function takeOff(Request $request, string $eventId, string $trayId, string $plateId): JsonResponse
    {
        $tray = $this->tray($eventId, $trayId);

        return $this->tapped($request, $tray->getEvent(), function () use ($request, $eventId, $tray, $plateId): JsonResponse {
            $this->serviceSteps->takeOff($tray, $this->plate($eventId, $plateId), self::expected(self::expectedBody($request), 'plates'), $this->grants($tray->getEvent()), $this->user());

            return $this->answered($tray->getCourse());
        });
    }

    #[Route('/api/events/{eventId}/service/trays/{trayId}/take-to-table', name: 'service_tray_take', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function takeToTable(Request $request, string $eventId, string $trayId): JsonResponse
    {
        $tray = $this->tray($eventId, $trayId);

        return $this->tapped($request, $tray->getEvent(), function () use ($request, $tray): JsonResponse {
            $this->serviceSteps->takeToTable($tray, self::expected(self::expectedBody($request), 'plates'), $this->grants($tray->getEvent()), $this->user());

            return $this->answered($tray->getCourse());
        });
    }

    #[Route('/api/events/{eventId}/service/trays/{trayId}/plates/{plateId}/served', name: 'service_tray_tick', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function tick(Request $request, string $eventId, string $trayId, string $plateId): JsonResponse
    {
        $tray = $this->tray($eventId, $trayId);

        return $this->tapped($request, $tray->getEvent(), function () use ($request, $eventId, $tray, $plateId): JsonResponse {
            $this->serviceSteps->tick($tray, $this->plate($eventId, $plateId), self::expected(self::expectedBody($request), 'plates'), $this->grants($tray->getEvent()), $this->user());

            return $this->answered($tray->getCourse());
        });
    }

    #[Route('/api/events/{eventId}/service/trays/{trayId}/all-served', name: 'service_tray_all_served', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function allServed(Request $request, string $eventId, string $trayId): JsonResponse
    {
        $tray = $this->tray($eventId, $trayId);

        return $this->tapped($request, $tray->getEvent(), function () use ($request, $tray): JsonResponse {
            $counts = $this->serviceSteps->allServed($tray, self::expected(self::expectedBody($request), 'plates'), $this->grants($tray->getEvent()), $this->user());

            return $this->answered($tray->getCourse(), Response::HTTP_OK, $counts);
        });
    }

    #[Route('/api/events/{eventId}/service/plates/{plateId}/sent-back', name: 'service_send_back', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function sendBack(Request $request, string $eventId, string $plateId): JsonResponse
    {
        $plate = $this->plate($eventId, $plateId);

        return $this->tapped($request, $plate->getEvent(), function () use ($request, $plate): JsonResponse {
            $body = Input::body($request, Type\shape(['reason' => Type\backed_enum(SentBackReason::class), 'expected' => self::expectedShape()]));
            $this->serviceSteps->sendBack($plate, $body['reason'], self::expected($body, 'plates'), $this->grants($plate->getEvent()), $this->user());

            return $this->answered($plate->getCourse());
        });
    }

    /** `subject` is a plate's, a tray's or an item's id. */
    #[Route('/api/events/{eventId}/service/undo', name: 'service_undo', methods: ['POST'])]
    #[InEvent(Permission::ServiceWork)]
    public function undo(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);

        return $this->tapped($request, $event, function () use ($request, $event): JsonResponse {
            $body = Input::body($request, Type\shape(['subject' => Type\string(), 'expected' => self::expectedShape()]));
            $this->serviceSteps->undo($event, $body['subject'], self::expected($body, null), $this->grants($event), $this->user());

            return new JsonResponse(null, Response::HTTP_NO_CONTENT);
        });
    }

    /**
     * A key and an answer kept for it: the same key again gets the first answer and changes nothing.
     *
     * @param Closure(): JsonResponse $write
     */
    private function tapped(Request $request, Event $event, Closure $write): JsonResponse
    {
        $user = $this->user();
        $sent = $this->serviceTaps->sent($request, $user);
        $earlier = $this->serviceTaps->earlier($user, $sent);

        if (null !== $earlier) {
            return $earlier;
        }

        try {
            $response = $write();
        } catch (ApiException $refusal) {
            // A request the device got wrong is not kept, so it can be sent again put right; a refusal of the step itself is the first answer.
            if (Response::HTTP_FORBIDDEN === $refusal->errorCode->status() || Response::HTTP_CONFLICT === $refusal->errorCode->status()) {
                $this->serviceTaps->refused($event, $user, $sent, $refusal);
            }

            throw $refusal;
        }

        $this->serviceTaps->answered($event, $user, $sent, $response);

        return $response;
    }

    /** @return Type\TypeInterface<array{plates?: array<string, PlateStage>, item?: ItemState}|null> */
    private static function expectedShape(): Type\TypeInterface
    {
        return Type\optional(Type\nullable(Type\shape(['plates' => Type\optional(Type\dict(Type\string(), Type\backed_enum(PlateStage::class))), 'item' => Type\optional(Type\backed_enum(ItemState::class))])));
    }

    /** @return array{expected?: array{plates?: array<string, PlateStage>, item?: ItemState}|null} */
    private static function expectedBody(Request $request): array
    {
        return Input::body($request, Type\shape(['expected' => self::expectedShape()]));
    }

    /**
     * @param array{expected?: array{plates?: array<string, PlateStage>, item?: ItemState}|null, ...} $body
     * @param 'plates'|'item'|null                                                                    $wanted null when either will do
     */
    private static function expected(array $body, ?string $wanted): Expected
    {
        $saw = $body['expected'] ?? null;
        $expected = new Expected($saw['plates'] ?? null, $saw['item'] ?? null);
        $missing = match ($wanted) {
            'plates' => null === $expected->plates,
            'item' => null === $expected->item,
            null => null === $expected->plates && null === $expected->item,
        };

        if ($missing) {
            throw new ApiException(ErrorCode::ExpectedRequired, 'service.expected_required');
        }

        return $expected;
    }

    /** @param array<string, mixed> $extra */
    private function answered(MenuCourse $course, int $status = Response::HTTP_OK, array $extra = []): JsonResponse
    {
        return new JsonResponse([...$extra, 'service' => $this->serviceRead->of($course, ['grants' => $this->grants($course->getEvent()), 'user' => $this->user()])], $status);
    }

    private function grants(Event $event): Grants
    {
        return $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId()) ?? Grants::only([]);
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function plate(string $eventId, string $plateId): ServicePlate
    {
        return $this->servicePlateRepository->findOneInEvent($this->event($eventId), $plateId) ?? throw ApiException::notFound('access.not_found');
    }

    private function tray(string $eventId, string $trayId): ServiceTray
    {
        return $this->serviceTrayRepository->findOneInEvent($this->event($eventId), $trayId) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
