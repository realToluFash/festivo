<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\MealAnswerKind;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One person's answer to one course (sc-3907), with the allergens they had when it was made: one recorded since serves a chosen pick as needs the host. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'meal_answers')]
#[ORM\UniqueConstraint(name: 'uniq_meal_answer', columns: ['guest_id', 'course_id'])]
#[ORM\Index(name: 'idx_meal_answer_dish', columns: ['dish_id'])]
class MealAnswer
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(name: 'guest_id', nullable: false, onDelete: 'CASCADE')]
    private Guest $person;

    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(name: 'course_id', nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: MealAnswerKind::class)]
    private MealAnswerKind $kind;

    #[ORM\ManyToOne(targetEntity: MenuDish::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?MenuDish $dish;

    #[ORM\ManyToOne(targetEntity: MenuDishVariant::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?MenuDishVariant $variant;

    /** @var list<string> the options' ids, each choice's in its order */
    #[ORM\Column(type: Types::JSON)]
    private array $options;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $allergensAtPick;

    /**
     * @param list<string> $options
     * @param list<string> $allergensAtPick
     */
    public function __construct(Guest $person, MenuCourse $course, MealAnswerKind $kind, ?MenuDish $dish, ?MenuDishVariant $variant, array $options, array $allergensAtPick)
    {
        $this->id = Uuid::v7();
        $this->person = $person;
        $this->course = $course;
        $this->kind = $kind;
        $this->dish = $dish;
        $this->variant = $variant;
        $this->options = $options;
        $this->allergensAtPick = $allergensAtPick;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getPerson(): Guest
    {
        return $this->person;
    }

    public function getCourse(): MenuCourse
    {
        return $this->course;
    }

    public function getKind(): MealAnswerKind
    {
        return $this->kind;
    }

    public function getDish(): ?MenuDish
    {
        return $this->dish;
    }

    public function getVariant(): ?MenuDishVariant
    {
        return $this->variant;
    }

    /** @return list<string> */
    public function getOptions(): array
    {
        return $this->options;
    }

    /** @return list<string> */
    public function getAllergensAtPick(): array
    {
        return $this->allergensAtPick;
    }

    /**
     * @param list<string> $options
     * @param list<string> $allergensAtPick
     */
    public function answer(MealAnswerKind $kind, ?MenuDish $dish, ?MenuDishVariant $variant, array $options, array $allergensAtPick): void
    {
        $this->kind = $kind;
        $this->dish = $dish;
        $this->variant = $variant;
        $this->options = $options;
        $this->allergensAtPick = $allergensAtPick;
    }
}
