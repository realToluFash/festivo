<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\SoftDeletable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Proof that entity → migration → database works, and nothing more.
 *
 * It exists so the path is exercised by a real round trip rather than assumed,
 * and so the conventions in docs/architecture/database.md have something that
 * demonstrates them. It carries no meaning and the first real entity should
 * replace it — see the note in that document.
 */
#[ORM\Entity]
#[ORM\Table(name: 'schema_probe')]
class SchemaProbe
{
    use SoftDeletable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 120)]
    private string $label;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, options: ['default' => 'CURRENT_TIMESTAMP'])]
    private DateTimeImmutable $createdAt;

    public function __construct(string $label)
    {
        $this->id = Uuid::v7();
        $this->label = $label;
        $this->createdAt = new DateTimeImmutable();
    }

    public function id(): Uuid
    {
        return $this->id;
    }

    public function label(): string
    {
        return $this->label;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
