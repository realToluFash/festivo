<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A dish on one course of an event's menu: the event's own copy (sc-3902), so editing the library dish it came from changes nothing here. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'menu_dishes')]
#[ORM\Index(name: 'idx_menu_dish_order', columns: ['course_id', 'position'])]
class MenuDish
{
    use Timestampable;

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

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

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

    public function getPosition(): int
    {
        return $this->position;
    }
}
