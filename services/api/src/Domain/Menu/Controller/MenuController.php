<?php

declare(strict_types=1);

namespace App\Domain\Menu\Controller;

use App\Domain\Menu\ChoiceRules;
use App\Domain\Menu\CourseRules;
use App\Domain\Menu\DefaultRules;
use App\Domain\Menu\DishRules;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Domain\Menu\ItemRules;
use App\Domain\Menu\MenuEditor;
use App\Domain\Menu\Pick\MenuReasks;
use App\Domain\Menu\VariantRules;
use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
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
use App\Repository\MenuDishChoiceRepository;
use App\Repository\MenuDishVariantRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
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
        private MenuReasks $menuReasks,
        private MenuSerialiser $menuSerialiser,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuDishChoiceRepository $menuDishChoiceRepository,
        private ItemRules $itemRules,
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

    /** The whole course; `ownItems` (sc-34230) left out keeps them, and so does `default` its default and choose-by date (sc-1362). `answer` "same" is refused 409 `menu_same_one_dish` unless it has exactly one dish; a new default after the date is refused 409 `menu_default_move` with `move` and `back` while it would move anyone, until sent with `confirmMove`. */
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
            'ownItems' => Type\optional(Type\vec(Type\string())),
            'default' => Type\optional(DefaultRules::sent()),
            'confirmMove' => Type\optional(Type\bool()),
        ]));
        $details = $this->courseRules->details($body['name'], $body['servedAt'] ?? null);
        $own = Iter\contains_key($body, 'ownItems') ? $this->itemRules->ownItems($body['ownItems']) : null;
        $this->menuEditor->changeCourse($event, $course, $details, 'choose' === $body['answer'], $body['skippable'], $own, $this->user(), $body['default'] ?? null, $body['confirmMove'] ?? false);

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

    /** `libraryDishId` copies that library dish; otherwise a new dish, saved to the library too unless `onlyForEvent`. A choosing course's first dish asks everyone coming (sc-3913). */
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
            $added = $this->menuEditor->addFromLibrary($event, $course, $dish, $this->user(), self::askAgain($request));

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
        $added = $this->menuEditor->addNew($event, $course, $details, $onlyHere, $body['allowShared'] ?? false, $this->user(), self::askAgain($request));

        return $this->menu($event, Response::HTTP_CREATED, ['dishId' => $added->getId()->toRfc4122()]);
    }

    /** `items` (sc-34230) left out keeps them. An allergen added asks again those who picked it with it recorded (sc-3913). */
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
            'items' => Type\optional(ItemRules::sent()),
        ]));
        $details = [] === $this->menuDishVariantRepository->findOnDish($dish)
            ? $this->dishRules->details($body['name'], $body['description'] ?? null, $body['allergens'] ?? [], $body['containsNone'] ?? false, $body['diets'] ?? [], null, null)
            : $this->dishRules->named($body['name'], $body['description'] ?? null);
        $items = Iter\contains_key($body, 'items')
            ? $this->itemRules->dishItems($body['items'], $dish, Vec\map($this->menuDishVariantRepository->findOnDish($dish), static fn (MenuDishVariant $one): string => $one->getName()), ...$this->menuDishChoiceRepository->findOnDish($dish))
            : null;
        $this->menuEditor->changeDish($event, $dish, $details, $items, $this->user(), self::askAgain($request));

        return $this->menu($event, Response::HTTP_OK, ['dishId' => $dish->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/menu/dishes/{dishId}', name: 'menu_dishes_remove', methods: ['DELETE'])]
    #[InEvent(Permission::MenuManage)]
    public function removeDish(Request $request, string $eventId, #[InThisEvent('dishId')] MenuDish $dish): JsonResponse
    {
        $event = $this->event($eventId);
        $this->menuEditor->removeDish($event, $dish, $this->user(), self::askAgain($request));

        return $this->menu($event);
    }

    /** Two at once on a dish without variants, then one. A picked dish's first variants ask again those who picked it (sc-3913). */
    #[Route('/api/events/{eventId}/menu/dishes/{dishId}/variants', name: 'menu_variants_add', methods: ['POST'])]
    #[InEvent(Permission::MenuManage)]
    public function addVariants(Request $request, string $eventId, #[InThisEvent('dishId')] MenuDish $dish): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, Type\shape(['variants' => Type\vec(VariantRules::sent())]));
        $this->refuseCostUnseen($event, $body['variants']);
        $this->menuEditor->addVariants($event, $dish, $body['variants'], $this->user(), self::askAgain($request));

        return $this->menu($event, Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/menu/variants/{variantId}', name: 'menu_variants_change', methods: ['PUT'])]
    #[InEvent(Permission::MenuManage)]
    public function changeVariant(Request $request, string $eventId, #[InThisEvent('variantId')] MenuDishVariant $variant): JsonResponse
    {
        $event = $this->event($eventId);
        $body = Input::body($request, VariantRules::sent());
        $this->refuseCostUnseen($event, [$body]);
        $this->menuEditor->changeVariant($event, $variant, $body, Iter\contains_key($body, 'cost'), $this->user(), self::askAgain($request));

        return $this->menu($event, Response::HTTP_OK, ['variantId' => $variant->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/menu/variants/{variantId}', name: 'menu_variants_remove', methods: ['DELETE'])]
    #[InEvent(Permission::MenuManage)]
    public function removeVariant(Request $request, string $eventId, #[InThisEvent('variantId')] MenuDishVariant $variant): JsonResponse
    {
        $event = $this->event($eventId);
        $this->menuEditor->removeVariant($event, $variant, $this->user(), self::askAgain($request));

        return $this->menu($event);
    }

    /** A question inside the dish, saved as a draft while unfinished. 409 `choice_limit` at 3. */
    #[Route('/api/events/{eventId}/menu/dishes/{dishId}/choices', name: 'menu_choices_add', methods: ['POST'])]
    #[InEvent(Permission::MenuManage)]
    public function addChoice(Request $request, string $eventId, #[InThisEvent('dishId')] MenuDish $dish): JsonResponse
    {
        $event = $this->event($eventId);
        $choice = $this->menuEditor->addChoice($event, $dish, Input::body($request, ChoiceRules::sent()), $this->user(), self::askAgain($request));

        return $this->menu($event, Response::HTTP_CREATED, ['choiceId' => $choice->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/menu/choices/{choiceId}', name: 'menu_choices_change', methods: ['PUT'])]
    #[InEvent(Permission::MenuManage)]
    public function changeChoice(Request $request, string $eventId, #[InThisEvent('choiceId')] MenuDishChoice $choice): JsonResponse
    {
        $event = $this->event($eventId);
        $this->menuEditor->changeChoice($event, $choice, Input::body($request, ChoiceRules::sent()), $this->user(), self::askAgain($request));

        return $this->menu($event, Response::HTTP_OK, ['choiceId' => $choice->getId()->toRfc4122()]);
    }

    #[Route('/api/events/{eventId}/menu/choices/{choiceId}', name: 'menu_choices_remove', methods: ['DELETE'])]
    #[InEvent(Permission::MenuManage)]
    public function removeChoice(Request $request, string $eventId, #[InThisEvent('choiceId')] MenuDishChoice $choice): JsonResponse
    {
        $event = $this->event($eventId);
        $this->menuEditor->removeChoice($event, $choice, $this->user(), self::askAgain($request));

        return $this->menu($event);
    }

    /** The people a menu change asked to pick again who have not answered yet, for Messaging to tell (epic 36). Nothing is sent from here (sc-3913). */
    #[Route('/api/events/{eventId}/menu/asked-again', name: 'menu_asked_again', methods: ['GET'])]
    #[InEvent(Permission::MenuRead)]
    public function askedAgain(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        if (true !== $this->membershipDirectory->grantsOnEvent($this->user(), $event->getOrganisation()->getId(), $event->getId())?->holds(Permission::GuestsRead)) {
            throw ApiException::permissionRequired(Permission::GuestsRead);
        }

        return new JsonResponse(['people' => $this->menuReasks->toTell($event)]);
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

    /** Sent as `?askAgain=1` once the host has confirmed the people a change asks again (sc-3913). */
    private static function askAgain(Request $request): bool
    {
        return $request->query->getBoolean('askAgain');
    }

    /** @param array<string, mixed> $more */
    private function menu(Event $event, int $status = Response::HTTP_OK, array $more = []): JsonResponse
    {
        return new JsonResponse(['menu' => $this->menuSerialiser->menu($event, $this->seesPrices($event))] + $more, $status);
    }

    /** @param list<array<string, mixed>> $variants */
    private function refuseCostUnseen(Event $event, array $variants): void
    {
        if (Iter\any($variants, static fn (array $one): bool => Iter\contains_key($one, 'cost')) && !$this->seesPrices($event)) {
            throw ApiException::permissionRequired(Permission::BudgetRead);
        }
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
