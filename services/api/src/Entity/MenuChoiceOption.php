<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One answer to a dish's choice (sc-3904), with what it contains: guests see the dish's allergens plus those of the options they pick. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'menu_choice_options')]
#[ORM\Index(name: 'idx_menu_choice_option_order', columns: ['choice_id', 'position'])]
class MenuChoiceOption
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: MenuDishChoice::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuDishChoice $choice;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    /** @var list<string> Annex II codes; empty is "contains none of the 14" */
    #[ORM\Column(type: Types::JSON)]
    private array $allergens;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    /** @param list<string> $allergens */
    public function __construct(MenuDishChoice $choice, string $name, array $allergens, int $position)
    {
        $this->id = Uuid::v7();
        $this->choice = $choice;
        $this->name = $name;
        $this->allergens = $allergens;
        $this->position = $position;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getChoice(): MenuDishChoice
    {
        return $this->choice;
    }

    public function getName(): string
    {
        return $this->name;
    }

    /** @return list<string> */
    public function getAllergens(): array
    {
        return $this->allergens;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    /** @param list<string> $allergens */
    public function describe(string $name, array $allergens, int $position): void
    {
        $this->name = $name;
        $this->allergens = $allergens;
        $this->position = $position;
    }
}
