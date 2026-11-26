<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Menu\Pick\ServedMeals;
use App\Domain\Service\Model\ServingTable;
use App\Entity\Guest;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\ServiceFiring;
use App\Entity\ServicePlate;
use App\Entity\User;
use App\Enum\MealAnswerKind;
use App\Locale\NameNormaliser;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use App\Repository\ServiceFiringRepository;
use App\Repository\ServicePlateRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** An order at To serve for every arrived guest at a table when its course is fired, and at once for one who arrives after (sc-4005). Firing itself is sc-4009's. */
final readonly class OrderMaker
{
    public const string CHEFS_CHOICE = '~chefs-choice';

    public function __construct(
        private ServingTables $servingTables,
        private ServedMeals $servedMeals,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private ServiceFiringRepository $serviceFiringRepository,
        private ServicePlateRepository $servicePlateRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** @return list<ServicePlate> the orders it made; a table fired again keeps its first firing and gains only the orders it lacks */
    public function fire(MenuCourse $course, ServingTable $table, DateTimeImmutable $at, User $by): array
    {
        if (null === $this->serviceFiringRepository->findOneAt($course, $table->key)) {
            $this->entityManager->persist(new ServiceFiring($course, $table->key, $at, $by));
        }

        return $this->ordersFor($course, $table, Vec\filter(Vec\map($table->guests, static fn (array $one): Guest => $one['guest']), static fn (Guest $guest): bool => $guest->hasArrived()), $at, $by);
    }

    public function isFiredFor(Guest $guest): bool
    {
        $table = $this->servingTables->ofGuest($guest->getEvent(), $guest);

        return null !== $table && [] !== $this->serviceFiringRepository->findAtTable($guest->getEvent(), $table->key);
    }

    /** @return list<ServicePlate> an order for each course already fired for the guest's table */
    public function arrived(Guest $guest, DateTimeImmutable $at, User $by): array
    {
        $table = $this->servingTables->ofGuest($guest->getEvent(), $guest);

        if (null === $table || !$guest->hasArrived()) {
            return [];
        }

        return Vec\flat_map(
            $this->serviceFiringRepository->findAtTable($guest->getEvent(), $table->key),
            fn (ServiceFiring $firing): array => $this->ordersFor($firing->getCourse(), $table, [$guest], $at, $by),
        );
    }

    /**
     * @param list<Guest> $guests
     * @return list<ServicePlate>
     */
    private function ordersFor(MenuCourse $course, ServingTable $table, array $guests, DateTimeImmutable $at, User $by): array
    {
        if ([] === $guests) {
            return [];
        }

        $have = Vec\map($this->servicePlateRepository->findOfCourse($course), static fn (ServicePlate $plate): string => $plate->isOrder() ? $plate->getGuest()->getId()->toRfc4122() : '');
        $answers = $this->servedMeals->of($guests)['answers'];
        $made = [];

        foreach ($guests as $guest) {
            $id = $guest->getId()->toRfc4122();

            if (Iter\contains($have, $id)) {
                continue;
            }

            $answer = Iter\search($answers[$id] ?? [], static fn (array $one): bool => $one['course'] === $course->getId()->toRfc4122());

            if (null !== $answer && MealAnswerKind::Skipped->value === $answer['answer']) {
                continue;
            }

            $dish = null === $answer || null === $answer['dish'] || MealAnswerKind::ChefsChoice->value === $answer['answer']
                ? null
                : $this->menuDishRepository->findOneInEvent($course->getEvent()->getId(), Uuid::fromString($answer['dish']));
            $plate = ServicePlate::order($course, $guest, $table->key, $this->items($course, $dish, $answer['variant'] ?? null, $answer['options'] ?? []), $at, $by);
            $this->entityManager->persist($plate);
            $made[] = $plate;
        }

        return $made;
    }

    /**
     * @param list<string> $options the option ids the guest picked
     * @return list<array{key: string, name: ?string}> the dish's, then the course's own, each once
     */
    private function items(MenuCourse $course, ?MenuDish $dish, ?string $variant, array $options): array
    {
        $names = null === $dish ? [null] : $this->dishItems($course, $dish, $variant, $options);
        $items = [];

        foreach ([...$names, ...$course->getOwnItems()] as $name) {
            $key = null === $name ? self::CHEFS_CHOICE : NameNormaliser::key($name);

            if (!Iter\any($items, static fn (array $item): bool => $item['key'] === $key)) {
                $items[] = ['key' => $key, 'name' => null === $name ? null : NameNormaliser::name($name)];
            }
        }

        return $items;
    }

    /**
     * @param list<string> $options
     * @return list<?string> null where the guest has no answer to a choice or a variant: Chef's choice
     */
    private function dishItems(MenuCourse $course, MenuDish $dish, ?string $variant, array $options): array
    {
        if ([] === $dish->getItems()) {
            return [$dish->getName()];
        }

        $eventId = $course->getEvent()->getId();
        $picked = Vec\filter_nulls(Vec\map($options, fn (string $id): ?MenuChoiceOption => Uuid::isValid($id) ? $this->menuChoiceOptionRepository->find(Uuid::fromString($id)) : null));

        return Vec\map($dish->getItems(), fn (array $item): ?string => match ($item['kind']) {
            'fixed' => $item['name'],
            'variants' => null === $variant ? null : $this->menuDishVariantRepository->findOneInEvent($eventId, Uuid::fromString($variant))?->getName(),
            'choice' => Iter\search($picked, static fn (MenuChoiceOption $option): bool => $option->getChoice()->getId()->toRfc4122() === $item['choiceId'])?->getName(),
        });
    }
}
