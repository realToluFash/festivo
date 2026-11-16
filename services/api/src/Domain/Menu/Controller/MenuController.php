<?php

declare(strict_types=1);

namespace App\Domain\Menu\Controller;

use App\Domain\Menu\CourseRules;
use App\Domain\Menu\DishRules;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Domain\Menu\MenuEditor;
use App\Domain\Menu\Model\UnwarnedPickers;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\DishRepository;
use App\Repository\EventRepository;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** An event's menu, built on its Menu page (sc-3902): menu.read sees it, menu.manage changes it. Every answer carries the menu whole. */
final readonly class MenuController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private DishRepository $dishRepository,
        private CourseRules $courseRules,
        private DishRules $dishRules,
        private MenuEditor $menuEditor,
        private MenuSerialiser $menuSerialiser,
        private MembershipDirectoryInterface $membershipDirectory,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/menu', name: 'menu_show', methods: ['GET'])]
    #[InEvent(Permission::MenuRead)]
    public function show(string $eventId): JsonResponse
    {
        return $this->menu($this->event($eventId));
    }

    /** `servedAt` is "20:30" in the event's zone, or null. Refused `validation_failed` on each field at once, and 409 `menu_course_limit` at 10 courses. */
    #[Route('/api/events/{eventId}/menu/courses', name: 'menu_courses_add', methods: ['POST'])]
    #[InEvent(Permission::MenuManage)]
    public function addCourse(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\string(),
            'servedAt' => Type\optional(Type\nullable(Type\string())),
        ]));
        $course = $this->menuEditor->addCourse($event, $this->courseRules->details($body['name'], $body['servedAt'] ?? null), $this->user());

        return $this->menu($event, Response::HTTP_CREATED, ['courseId' => $course->getId()->toRfc4122()]);
    }

    /** The whole course. `answer` "same" is refused 409 `menu_same_one_dish` unless it has exactly one dish. */
    #[Route('/api/events/{eventId}/menu/courses/{courseId}', name: 'menu_courses_change', methods: ['PUT'])]
    #[InEvent(Permission::MenuManage)]
    public function changeCourse(Request $request, string $eventId, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\string(),
            'servedAt' => Type\optional(Type\nullable(Type\string())),
            'answer' => Type\union(Type\literal_scalar('choose'), Type\literal_scalar('same')),
            'skippable' => Type\bool(),
        ]));
        $details = $this->courseRules->details($body['name'], $body['servedAt'] ?? null);
        $this->menuEditor->changeCourse($event, $course, $details, 'choose' === $body['answer'], $body['skippable'], $this->user());

        return $this->menu($event, Response::HTTP_OK, ['courseId' => $course->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/menu/courses/{courseId}/move', name: 'menu_courses_move', methods: ['POST'])]
    #[InEvent(Permission::MenuManage)]
    public function moveCourse(Request $request, string $eventId, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['to' => Type\int()]));
        $this->menuEditor->moveCourse($event, $course, $body['to'], $this->user());

        return $this->menu($event, Response::HTTP_OK, ['courseId' => $course->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/menu/courses/{courseId}', name: 'menu_courses_delete', methods: ['DELETE'])]
    #[InEvent(Permission::MenuManage)]
    public function deleteCourse(string $eventId, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        $event = $this->event($eventId);
        $this->menuEditor->deleteCourse($event, $course, $this->user());

        return $this->menu($event);
    }

    /** `libraryDishId` copies that library dish; otherwise a new dish, saved to the library too unless `onlyForEvent`. */
    #[Route('/api/events/{eventId}/menu/courses/{courseId}/dishes', name: 'menu_dishes_add', methods: ['POST'])]
    #[InEvent(Permission::MenuManage)]
    public function addDish(Request $request, string $eventId, #[InThisEvent('courseId')] MenuCourse $course): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'libraryDishId' => Type\optional(Type\string()),
            'name' => Type\optional(Type\string()),
            'description' => Type\optional(Type\nullable(Type\string())),
            'allergens' => Type\optional(Type\vec(Type\string())),
            'containsNone' => Type\optional(Type\bool()),
            'diets' => Type\optional(Type\vec(Type\string())),
            'lastPrice' => Type\optional(Type\nullable(Type\shape([
                'amount' => Type\string(),
                'currency' => Type\string(),
            ]))),
            'onlyForEvent' => Type\optional(Type\bool()),
            'allowShared' => Type\optional(Type\bool()),
        ]));

        if (Iter\contains_key($body, 'libraryDishId')) {
            $id = $body['libraryDishId'];
            $dish = Uuid::isValid($id) ? $this->dishRepository->findOneInOrganisation($event->getOrganisation(), Uuid::fromString($id)) : null;
            if (null === $dish || null !== $dish->getArchivedAt()) {
                throw ApiException::notFound('access.not_found');
            }
            $added = $this->menuEditor->addFromLibrary($event, $course, $dish, $this->user());

            return $this->menu($event, Response::HTTP_CREATED, ['dishId' => $added->getId()->toRfc4122()]);
        }

        $onlyHere = $body['onlyForEvent'] ?? false;

        if (Iter\contains_key($body, 'lastPrice') && !$this->seesPrices($event)) {
            throw ApiException::permissionRequired(Permission::BudgetRead);
        }

        $details = $this->dishRules->details(
            $body['name'] ?? '',
            $body['description'] ?? null,
            $body['allergens'] ?? [],
            $body['containsNone'] ?? false,
            $body['diets'] ?? [],
            $onlyHere ? null : ($body['lastPrice'] ?? null),
            null,
        );
        $added = $this->menuEditor->addNew($event, $course, $details, $onlyHere, $body['allowShared'] ?? false, $this->user());

        return $this->menu($event, Response::HTTP_CREATED, ['dishId' => $added->getId()->toRfc4122()]);
    }

    /** Never refused for picks. `unwarned` counts who picked it and has an allergen just added recorded, until sc-3913. */
    #[Route('/api/events/{eventId}/menu/dishes/{dishId}', name: 'menu_dishes_change', methods: ['PUT'])]
    #[InEvent(Permission::MenuManage)]
    public function changeDish(Request $request, string $eventId, #[InThisEvent('dishId')] MenuDish $dish): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape([
            'name' => Type\string(),
            'description' => Type\optional(Type\nullable(Type\string())),
            'allergens' => Type\optional(Type\vec(Type\string())),
            'containsNone' => Type\optional(Type\bool()),
            'diets' => Type\optional(Type\vec(Type\string())),
        ]));
        $details = $this->dishRules->details($body['name'], $body['description'] ?? null, $body['allergens'] ?? [], $body['containsNone'] ?? false, $body['diets'] ?? [], null, null);
        $unwarned = $this->menuEditor->changeDish($event, $dish, $details, $this->user());

        return $this->menu($event, Response::HTTP_OK, ['dishId' => $dish->getId()->toRfc4122(), 'unwarned' => self::unwarned($unwarned)]);
    }

    #[Route('/api/events/{eventId}/menu/dishes/{dishId}', name: 'menu_dishes_remove', methods: ['DELETE'])]
    #[InEvent(Permission::MenuManage)]
    public function removeDish(string $eventId, #[InThisEvent('dishId')] MenuDish $dish): JsonResponse
    {
        $event = $this->event($eventId);
        $this->menuEditor->removeDish($event, $dish, $this->user());

        return $this->menu($event);
    }

    #[Route('/api/events/{eventId}/menu/subscriptions', name: 'menu_subscribe', methods: ['POST'])]
    #[InEvent(Permission::MenuRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventMenu($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    /** @return ?array{count: int, allergens: list<string>} */
    private static function unwarned(?UnwarnedPickers $unwarned): ?array
    {
        return null === $unwarned ? null : ['count' => $unwarned->count, 'allergens' => $unwarned->allergens];
    }

    /** @param array<string, mixed> $more */
    private function menu(Event $event, int $status = Response::HTTP_OK, array $more = []): JsonResponse
    {
        return new JsonResponse(['menu' => $this->menuSerialiser->menu($event)] + $more, $status);
    }

    private function seesPrices(Event $event): bool
    {
        return true === $this->membershipDirectory->eventScopeIn($this->user(), $event->getOrganisation()->getId())?->anywhere(Permission::BudgetRead);
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
