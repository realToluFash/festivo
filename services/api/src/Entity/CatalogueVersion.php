<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\CataloguePart;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One published version of one half of the plan catalogue (sc-3928). Never edited once written: a change is a new version. */
#[ORM\Entity]
#[ORM\Table(name: 'catalogue_versions')]
#[ORM\UniqueConstraint(name: 'uniq_catalogue_version_name', columns: ['part', 'name'])]
class CatalogueVersion
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: CataloguePart::class)]
    private CataloguePart $part;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $name;

    /** @var array<array-key, mixed> the document `CatalogueParser` reads */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $terms;

    #[ORM\Column(type: Types::STRING, length: 2000)]
    private string $note;

    /** The member of staff who published it, as the audit trail names them. */
    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $publishedBy;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $publishedAt;

    /** When it applies: its publication for plans, later for a rise in unit costs. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $effectiveFrom;

    /** @param array<array-key, mixed> $terms */
    public function __construct(
        CataloguePart $part,
        string $name,
        array $terms,
        string $note,
        string $publishedBy,
        DateTimeImmutable $publishedAt,
        DateTimeImmutable $effectiveFrom,
    ) {
        $this->id = Uuid::v7();
        $this->part = $part;
        $this->name = $name;
        $this->terms = $terms;
        $this->note = $note;
        $this->publishedBy = $publishedBy;
        $this->publishedAt = $publishedAt;
        $this->effectiveFrom = $effectiveFrom;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getPart(): CataloguePart
    {
        return $this->part;
    }

    public function getName(): string
    {
        return $this->name;
    }

    /** @return array<array-key, mixed> */
    public function getTerms(): array
    {
        return $this->terms;
    }

    public function getNote(): string
    {
        return $this->note;
    }

    public function getPublishedBy(): string
    {
        return $this->publishedBy;
    }

    public function getPublishedAt(): DateTimeImmutable
    {
        return $this->publishedAt;
    }

    public function getEffectiveFrom(): DateTimeImmutable
    {
        return $this->effectiveFrom;
    }
}
