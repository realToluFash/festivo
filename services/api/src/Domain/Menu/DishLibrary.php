<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Audit\Auditor;
use App\Domain\Menu\Model\DishDetails;
use App\Entity\Dish;
use App\Entity\DishVariant;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\DishRepository;
use App\Repository\DishVariantRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An organisation's menu library (sc-3901). Editing it changes no event: an event keeps its own copy of what it served. */
final readonly class DishLibrary
{
    public const string ADDED = 'dish.added';

    public const string EDITED = 'dish.edited';

    public const string ARCHIVED = 'dish.archived';

    public const string RESTORED = 'dish.restored';

    public const string DELETED = 'dish.deleted';

    public const string VARIANT_ADDED = 'dish.variant_added';

    public const string VARIANT_EDITED = 'dish.variant_edited';

    public const string VARIANT_REMOVED = 'dish.variant_removed';

    public const string FOLDED = 'dish.folded';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private DishRepository $dishRepository,
        private DishVariantRepository $dishVariantRepository,
        private VariantRules $variantRules,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** Refused 409 `dish_name_shared`, naming the stored name, when another dish has the name ignoring case and accents, archived ones included, unless `allowShared`. */
    public function add(Organisation $organisation, DishDetails $details, User $by, bool $allowShared): Dish
    {
        return $this->entityManager->wrapInTransaction(function () use ($organisation, $details, $by, $allowShared): Dish {
            $this->entityManager->refresh($organisation, LockMode::PESSIMISTIC_WRITE);

            if (!$allowShared) {
                $this->refuseShared($organisation, $details->name, null);
            }

            $dish = new Dish($organisation, $details->name, $details->description, $details->allergens, $details->diets);
            $dish->setLastPrice($details->lastPrice?->minor, $details->lastPrice?->currency);
            $this->entityManager->persist($dish);
            $this->audit(self::ADDED, $dish, $by);
            $this->entityManager->flush();

            return $dish;
        });
    }

    /** Asks as Add does only when the name changed. Without `$withPrice` the last price stays as it was. */
    public function edit(Dish $dish, DishDetails $details, bool $withPrice, User $by, bool $allowShared): Dish
    {
        return $this->entityManager->wrapInTransaction(function () use ($dish, $details, $withPrice, $by, $allowShared): Dish {
            $this->entityManager->refresh($dish->getOrganisation(), LockMode::PESSIMISTIC_WRITE);

            if (!$allowShared && $details->name !== $dish->getName()) {
                $this->refuseShared($dish->getOrganisation(), $details->name, $dish);
            }

            $dish->setName($details->name);
            $dish->setDescription($details->description);

            if ([] !== $this->dishVariantRepository->findOnDish($dish)) {
                $this->audit(self::EDITED, $dish, $by);
                $this->entityManager->flush();

                return $dish;
            }

            $dish->setAllergens($details->allergens);
            $dish->setDiets($details->diets);

            if ($withPrice) {
                $dish->setLastPrice($details->lastPrice?->minor, $details->lastPrice?->currency);
            }

            $this->audit(self::EDITED, $dish, $by);
            $this->entityManager->flush();

            return $dish;
        });
    }

    /** @param list<array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}}> $sent */
    public function addVariants(Dish $dish, array $sent, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($dish, $sent, $by): void {
            $this->entityManager->refresh($dish->getOrganisation(), LockMode::PESSIMISTIC_WRITE);
            $variants = $this->dishVariantRepository->findOnDish($dish);
            $this->variantRules->refuseCount(Iter\count($variants), Iter\count($sent));
            $details = $this->variantRules->details($sent, $variants, null);
            $next = [] === $variants ? 0 : Math\max(Vec\map($variants, static fn (DishVariant $one): int => $one->getPosition())) + 1;
            $added = [];

            foreach ($details as $at => $one) {
                $variant = new DishVariant($dish, $one->name, $one->forChildren, $one->allergens, $one->diets, $next + $at);
                $variant->setLastPrice($one->price?->minor, $one->price?->currency);
                $this->entityManager->persist($variant);
                $added[] = $variant;
            }

            $this->variantAudit(self::VARIANT_ADDED, $dish, $by, Vec\map($added, static fn (DishVariant $one): string => $one->getName()));
            $this->entityManager->flush();
        });
    }

    /** @param array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}} $sent */
    public function editVariant(DishVariant $variant, array $sent, bool $withPrice, User $by): DishVariant
    {
        return $this->entityManager->wrapInTransaction(function () use ($variant, $sent, $withPrice, $by): DishVariant {
            $dish = $variant->getDish();
            $this->entityManager->refresh($dish->getOrganisation(), LockMode::PESSIMISTIC_WRITE);
            $others = Vec\filter($this->dishVariantRepository->findOnDish($dish), static fn (DishVariant $one): bool => $one !== $variant);
            $details = $this->variantRules->details([$sent], Vec\values($others), null, $variant->getLastPriceCurrency())[0];
            $variant->describe($details->name, $details->forChildren, $details->allergens, $details->diets);

            if ($withPrice) {
                $variant->setLastPrice($details->price?->minor, $details->price?->currency);
            }

            $this->variantAudit(self::VARIANT_EDITED, $dish, $by, [$variant->getName()]);
            $this->entityManager->flush();

            return $variant;
        });
    }

    /** Removing one of two folds the other into the dish, with its last price. */
    public function removeVariant(DishVariant $variant, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($variant, $by): void {
            $dish = $variant->getDish();
            $this->entityManager->refresh($dish->getOrganisation(), LockMode::PESSIMISTIC_WRITE);
            $left = Vec\values(Vec\filter($this->dishVariantRepository->findOnDish($dish), static fn (DishVariant $one): bool => $one !== $variant));

            if (Iter\count($left) >= 2 && !$variant->isForChildren() && Iter\all($left, static fn (DishVariant $one): bool => $one->isForChildren())) {
                throw new ApiException(ErrorCode::VariantLastEveryone, 'menu.variant_last_everyone', parameters: ['{variant}' => $variant->getName()]);
            }

            $this->variantAudit(self::VARIANT_REMOVED, $dish, $by, [$variant->getName()]);
            $this->entityManager->remove($variant);

            if (1 === Iter\count($left)) {
                $staying = $left[0];
                $dish->setAllergens($staying->getAllergens());
                $dish->setDiets($staying->getDiets());
                $dish->setLastPrice($staying->getLastPriceMinor(), $staying->getLastPriceCurrency());
                $this->variantAudit(self::FOLDED, $dish, $by, [$staying->getName()]);
                $this->entityManager->remove($staying);
            }

            $this->entityManager->flush();
        });
    }

    public function archive(Dish $dish, User $by): Dish
    {
        if (null === $dish->getArchivedAt()) {
            $dish->setArchivedAt($this->clock->now());
            $this->audit(self::ARCHIVED, $dish, $by);
            $this->entityManager->flush();
        }

        return $dish;
    }

    public function restore(Dish $dish, User $by): Dish
    {
        if (null !== $dish->getArchivedAt()) {
            $dish->setArchivedAt(null);
            $this->audit(self::RESTORED, $dish, $by);
            $this->entityManager->flush();
        }

        return $dish;
    }

    /** Refused 409 `dish_in_use` once an event has used it: archiving is the way out, and the event keeps its copy either way. */
    public function delete(Dish $dish, User $by): void
    {
        if ($dish->isUsedByEvent()) {
            throw new ApiException(ErrorCode::DishInUse, $this->translator->trans('dish.in_use'));
        }

        $this->audit(self::DELETED, $dish, $by);
        $this->entityManager->remove($dish);
        $this->entityManager->flush();
    }

    /** An active dish wins over an archived one, so `archived` is true only when every match is archived. */
    private function refuseShared(Organisation $organisation, string $name, ?Dish $besides): void
    {
        $key = NameNormaliser::key($name);
        $matches = Vec\filter(
            $this->dishRepository->findInOrganisation($organisation),
            static fn (Dish $dish): bool => $dish !== $besides && NameNormaliser::key($dish->getName()) === $key,
        );

        if ([] === $matches) {
            return;
        }

        $shared = Iter\search($matches, static fn (Dish $dish): bool => null === $dish->getArchivedAt()) ?? $matches[0];

        throw new ApiException(
            ErrorCode::DishNameShared,
            $this->translator->trans('dish.name_shared', ['{name}' => $shared->getName()]),
            members: ['sharedWith' => $shared->getName(), 'archived' => null !== $shared->getArchivedAt()],
        );
    }

    private function audit(string $action, Dish $dish, User $by): void
    {
        $this->auditor->record($action, 'Dish', $dish->getId(), Actor::User, $by->getId(), $by->getName());
    }

    /** @param list<string> $variants */
    private function variantAudit(string $action, Dish $dish, User $by, array $variants): void
    {
        $this->auditor->record($action, 'Dish', $dish->getId(), Actor::User, $by->getId(), $by->getName(), ['variants' => [null, $variants]]);
    }
}
