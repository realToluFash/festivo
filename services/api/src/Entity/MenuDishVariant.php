<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One way an event's dish comes (sc-3903), with its own allergens, diets and cost: guests pick a variant, never the dish. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'menu_dish_variants')]
#[ORM\Index(name: 'idx_menu_dish_variant_order', columns: ['dish_id', 'position'])]
class MenuDishVariant
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: MenuDish::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuDish $dish;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $forChildren;

    /** @var list<string> Annex II codes; empty is "contains none of the 14" */
    #[ORM\Column(type: Types::JSON)]
    private array $allergens;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $diets;

    /** In the event's currency's minor unit; null is unpriced, never zero. */
    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $costMinor;

    /** The library Last price's currency when it was not the event's, so the copy's Cost is left for the host to set. */
    #[ORM\Column(type: Types::STRING, length: 3, nullable: true)]
    private ?string $pricedIn = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     */
    public function __construct(MenuDish $dish, string $name, bool $forChildren, array $allergens, array $diets, ?int $costMinor, int $position)
    {
        $this->id = Uuid::v7();
        $this->dish = $dish;
        $this->name = $name;
        $this->forChildren = $forChildren;
        $this->allergens = $allergens;
        $this->diets = $diets;
        $this->costMinor = null === $costMinor ? null : (string) $costMinor;
        $this->position = $position;
    }

    public static function copyOf(DishVariant $variant, MenuDish $dish, string $eventCurrency): self
    {
        $price = $variant->getLastPriceMinor();
        $same = null !== $price && $variant->getLastPriceCurrency() === $eventCurrency;
        $copy = new self($dish, $variant->getName(), $variant->isForChildren(), $variant->getAllergens(), $variant->getDiets(), $same ? $price : null, $variant->getPosition());
        $copy->pricedIn = null === $price || $same ? null : $variant->getLastPriceCurrency();

        return $copy;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getDish(): MenuDish
    {
        return $this->dish;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function isForChildren(): bool
    {
        return $this->forChildren;
    }

    /** @return list<string> */
    public function getAllergens(): array
    {
        return $this->allergens;
    }

    /** @return list<string> */
    public function getDiets(): array
    {
        return $this->diets;
    }

    public function getCostMinor(): ?int
    {
        return null === $this->costMinor ? null : (int) $this->costMinor;
    }

    public function getPricedIn(): ?string
    {
        return $this->pricedIn;
    }

    /**
     * @param list<string> $allergens
     * @param list<string> $diets
     */
    public function describe(string $name, bool $forChildren, array $allergens, array $diets): void
    {
        $this->name = $name;
        $this->forChildren = $forChildren;
        $this->allergens = $allergens;
        $this->diets = $diets;
    }

    /** A cost saved clears the line saying the library priced it in another currency. */
    public function setCostMinor(?int $costMinor): void
    {
        $this->costMinor = null === $costMinor ? null : (string) $costMinor;

        if (null !== $costMinor) {
            $this->pricedIn = null;
        }
    }

    public function getPosition(): int
    {
        return $this->position;
    }
}
