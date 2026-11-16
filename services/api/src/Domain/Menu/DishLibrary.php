<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Audit\Auditor;
use App\Domain\Menu\Model\DishDetails;
use App\Entity\Dish;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\DishRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
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

    public function __construct(
        private EntityManagerInterface $entityManager,
        private DishRepository $dishRepository,
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

    /** Refused 409 `dish_in_use` once an event has used it: it is archived instead, and the event keeps its copy either way. */
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
}
