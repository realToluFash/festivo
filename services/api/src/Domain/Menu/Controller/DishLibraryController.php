<?php

declare(strict_types=1);

namespace App\Domain\Menu\Controller;

use App\Domain\Menu\DishLibrary;
use App\Domain\Menu\DishRules;
use App\Domain\Menu\Http\DishSerialiser;
use App\Domain\Menu\Model\DishDetails;
use App\Entity\Dish;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\DishRepository;
use App\Repository\OrganisationRepository;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** The organisation's menu library (sc-3901): menu.read sees it, menu.manage changes it, and only budget.read sees or sends a last price, each held across the organisation or on any one event. */
final readonly class DishLibraryController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private DishRepository $dishRepository,
        private DishRules $dishRules,
        private DishLibrary $dishLibrary,
        private MembershipDirectoryInterface $membershipDirectory,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/dishes', name: 'dishes_list', methods: ['GET'])]
    #[InOrganisation(Permission::MenuRead, orOnAnEvent: true)]
    public function list(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $scope = $this->membershipDirectory->eventScopeIn($this->user(), $organisation->getId());
        $withPrice = true === $scope?->anywhere(Permission::BudgetRead);

        return new JsonResponse([
            'dishes' => Vec\map($this->dishRepository->findInOrganisation($organisation), static fn (Dish $dish): array => DishSerialiser::dish($dish, $withPrice)),
            'canManage' => true === $scope?->anywhere(Permission::MenuManage) && !$scope->organisation->isReadOnly(),
            'seesPrices' => $withPrice,
        ]);
    }

    /** Refused `validation_failed` on each field at once, and 409 `dish_name_shared` naming `sharedWith` and whether it is `archived`, until `allowShared`. */
    #[Route('/api/orgs/{organisationId}/dishes', name: 'dishes_add', methods: ['POST'])]
    #[InOrganisation(Permission::MenuManage, orOnAnEvent: true)]
    public function add(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, self::shape());
        $withPrice = $this->pricing($organisation, $body);
        $dish = $this->dishLibrary->add($organisation, $this->details($body, null), $this->user(), $body['allowShared'] ?? false);

        return new JsonResponse(['dish' => DishSerialiser::dish($dish, $withPrice)], Response::HTTP_CREATED);
    }

    /** The whole dish. Without `lastPrice`, the last price stays as it was; null clears it. */
    #[Route('/api/orgs/{organisationId}/dishes/{dishId}', name: 'dishes_edit', methods: ['PUT'])]
    #[InOrganisation(Permission::MenuManage, orOnAnEvent: true)]
    public function edit(Request $request, string $organisationId, string $dishId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $dish = $this->dish($organisation, $dishId);
        $body = Input::body($request, self::shape());
        $withPrice = $this->pricing($organisation, $body);
        $sent = Iter\contains_key($body, 'lastPrice');
        $this->dishLibrary->edit($dish, $this->details($body, $dish->getLastPriceCurrency()), $sent, $this->user(), $body['allowShared'] ?? false);

        return new JsonResponse(['dish' => DishSerialiser::dish($dish, $withPrice)]);
    }

    #[Route('/api/orgs/{organisationId}/dishes/{dishId}/archive', name: 'dishes_archive', methods: ['POST'])]
    #[InOrganisation(Permission::MenuManage, orOnAnEvent: true)]
    public function archive(string $organisationId, string $dishId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $dish = $this->dishLibrary->archive($this->dish($organisation, $dishId), $this->user());

        return new JsonResponse(['dish' => DishSerialiser::dish($dish, $this->seesPrices($organisation))]);
    }

    #[Route('/api/orgs/{organisationId}/dishes/{dishId}/restore', name: 'dishes_restore', methods: ['POST'])]
    #[InOrganisation(Permission::MenuManage, orOnAnEvent: true)]
    public function restore(string $organisationId, string $dishId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $dish = $this->dishLibrary->restore($this->dish($organisation, $dishId), $this->user());

        return new JsonResponse(['dish' => DishSerialiser::dish($dish, $this->seesPrices($organisation))]);
    }

    #[Route('/api/orgs/{organisationId}/dishes/{dishId}', name: 'dishes_delete', methods: ['DELETE'])]
    #[InOrganisation(Permission::MenuManage, orOnAnEvent: true)]
    public function delete(string $organisationId, string $dishId): Response
    {
        $this->dishLibrary->delete($this->dish($this->organisation($organisationId), $dishId), $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** @return Type\TypeInterface<array{name: string, description?: ?string, allergens?: list<string>, containsNone?: bool, diets?: list<string>, lastPrice?: ?array{amount: string, currency: string}, allowShared?: bool}> */
    private static function shape(): Type\TypeInterface
    {
        return Type\shape([
            'name' => Type\string(),
            'description' => Type\optional(Type\nullable(Type\string())),
            'allergens' => Type\optional(Type\vec(Type\string())),
            'containsNone' => Type\optional(Type\bool()),
            'diets' => Type\optional(Type\vec(Type\string())),
            'lastPrice' => Type\optional(Type\nullable(Type\shape([
                'amount' => Type\string(),
                'currency' => Type\string(),
            ]))),
            'allowShared' => Type\optional(Type\bool()),
        ]);
    }

    /** @param array{name: string, description?: ?string, allergens?: list<string>, containsNone?: bool, diets?: list<string>, lastPrice?: ?array{amount: string, currency: string}, allowShared?: bool} $body */
    private function details(array $body, ?string $heldCurrency): DishDetails
    {
        return $this->dishRules->details(
            $body['name'],
            $body['description'] ?? null,
            $body['allergens'] ?? [],
            $body['containsNone'] ?? false,
            $body['diets'] ?? [],
            $body['lastPrice'] ?? null,
            $heldCurrency,
        );
    }

    /** @param array<string, mixed> $body a last price sent without budget.read is refused, never quietly dropped */
    private function pricing(Organisation $organisation, array $body): bool
    {
        $withPrice = $this->seesPrices($organisation);

        if (!$withPrice && Iter\contains_key($body, 'lastPrice')) {
            throw ApiException::permissionRequired(Permission::BudgetRead);
        }

        return $withPrice;
    }

    private function seesPrices(Organisation $organisation): bool
    {
        return true === $this->membershipDirectory->eventScopeIn($this->user(), $organisation->getId())?->anywhere(Permission::BudgetRead);
    }

    private function dish(Organisation $organisation, string $id): Dish
    {
        $dish = Uuid::isValid($id) ? $this->dishRepository->findOneInOrganisation($organisation, Uuid::fromString($id)) : null;

        return $dish ?? throw ApiException::notFound('access.not_found');
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
