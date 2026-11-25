<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A question inside an event's dish (sc-3904), whose options don't change what the dish is. Unfinished, it is a draft and hides the dish from guests. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'menu_dish_choices')]
#[ORM\Index(name: 'idx_menu_dish_choice_order', columns: ['dish_id', 'position'])]
class MenuDishChoice
{
    use Timestampable;

    public const int PER_DISH_MAXIMUM = 3;

    public const int QUESTION_MAXIMUM = 80;

    public const int OPTIONS_MINIMUM = 2;

    public const int OPTIONS_MAXIMUM = 8;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: MenuDish::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuDish $dish;

    /** Empty while it is a draft with no question yet. */
    #[ORM\Column(type: Types::STRING, length: 320)]
    private string $question;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $pick;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $required;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    public function __construct(MenuDish $dish, string $question, int $pick, bool $required, int $position)
    {
        $this->id = Uuid::v7();
        $this->dish = $dish;
        $this->question = $question;
        $this->pick = $pick;
        $this->required = $required;
        $this->position = $position;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getDish(): MenuDish
    {
        return $this->dish;
    }

    public function getQuestion(): string
    {
        return $this->question;
    }

    /** How many options a guest picks, exactly. */
    public function getPick(): int
    {
        return $this->pick;
    }

    public function isRequired(): bool
    {
        return $this->required;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function ask(string $question, int $pick, bool $required): void
    {
        $this->question = $question;
        $this->pick = $pick;
        $this->required = $required;
    }
}
