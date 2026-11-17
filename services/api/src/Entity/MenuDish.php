<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Iter;
use Symfony\Component\Uid\Uuid;

/**
 * A dish on one course of an event's menu: the event's own copy (sc-3902), so editing the library dish it came from changes nothing here.
 *
 * @phpstan-type DishItem array{kind: 'fixed', name: string}|array{kind: 'choice', choiceId: string}|array{kind: 'variants'}
 */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'menu_dishes')]
#[ORM\Index(name: 'idx_menu_dish_order', columns: ['course_id', 'position'])]
class MenuDish
{
    use Timestampable;

    public const int ITEMS_MAXIMUM = 6;

    public const int ITEM_NAME_MAXIMUM = 40;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    /** The library dish this was copied from; null when it was added only for this event. */
    #[ORM\ManyToOne(targetEntity: Dish::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Dish $libraryDish;

    #[ORM\Column(type: Types::STRING, length: 480)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 1200, nullable: true)]
    private ?string $description;

    /** @var ?list<string> as on Dish: empty is "contains none of the 14", null is never stated */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $allergens;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $diets;

    /** In the event's currency's minor unit, taken from the variant a dish folded back from (sc-3903); null is unpriced. */
    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $costMinor = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    /** @var list<DishItem> what a plate of it holds, in order (sc-34230); none is the dish as one item */
    #[ORM\Column(type: Types::JSON, options: ['default' => '[]'])]
    private array $items = [];

    /**
     * @param ?list<string> $allergens
     * @param list<string>  $diets
     */
    public function __construct(MenuCourse $course, ?Dish $libraryDish, string $name, ?string $description, ?array $allergens, array $diets, int $position)
    {
        $this->id = Uuid::v7();
        $this->course = $course;
        $this->libraryDish = $libraryDish;
        $this->name = $name;
        $this->description = $description;
        $this->allergens = $allergens;
        $this->diets = $diets;
        $this->position = $position;
    }

    public static function copyOf(Dish $dish, MenuCourse $course, int $position): self
    {
        return new self($course, $dish, $dish->getName(), $dish->getDescription(), $dish->getAllergens(), $dish->getDiets(), $position);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getCourse(): MenuCourse
    {
        return $this->course;
    }

    public function getLibraryDish(): ?Dish
    {
        return $this->libraryDish;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    /** @return ?list<string> */
    public function getAllergens(): ?array
    {
        return $this->allergens;
    }

    /** @return list<string> */
    public function getDiets(): array
    {
        return $this->diets;
    }

    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     */
    public function describe(string $name, ?string $description, array $allergens, array $diets): void
    {
        $this->name = $name;
        $this->description = $description;
        $this->allergens = $allergens;
        $this->diets = $diets;
    }

    public function getCostMinor(): ?int
    {
        return null === $this->costMinor ? null : (int) $this->costMinor;
    }

    /** The dish becomes the one variant left: its allergens, diets and cost, which may be none. */
    public function foldFrom(MenuDishVariant $variant): void
    {
        $this->allergens = $variant->getAllergens();
        $this->diets = $variant->getDiets();
        $this->costMinor = null === $variant->getCostMinor() ? null : (string) $variant->getCostMinor();
    }

    /** Its variants carry the cost from here on, so the dish lets go of the one a fold gave it. */
    public function takeVariants(): void
    {
        $this->costMinor = null;
    }

    public function rename(string $name, ?string $description): void
    {
        $this->name = $name;
        $this->description = $description;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    /** @return list<DishItem> */
    public function getItems(): array
    {
        return $this->items;
    }

    /** @param list<DishItem> $items */
    public function listItems(array $items): void
    {
        $this->items = $items;
    }

    /** A choice's item, or with null the variant's; a single item left can't stand alone, so it goes too. */
    public function dropItem(?string $choiceId): void
    {
        $left = [];

        foreach ($this->items as $item) {
            $leaving = null === $choiceId ? 'variants' === $item['kind'] : 'choice' === $item['kind'] && $choiceId === $item['choiceId'];

            if (!$leaving) {
                $left[] = $item;
            }
        }

        $this->items = 1 === Iter\count($left) ? [] : $left;
    }
}
