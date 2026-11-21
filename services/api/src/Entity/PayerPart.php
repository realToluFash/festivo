<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One payer's part of a cost (sc-91): under the line's split, a percentage in hundredths (10000 for all of it) or a fixed amount in the event currency's minor unit. */
#[ORM\Entity]
#[ORM\Table(name: 'payer_parts')]
#[ORM\Index(name: 'idx_payer_part_payer', columns: ['payer_id'])]
#[ORM\UniqueConstraint(name: 'uniq_payer_part', columns: ['line_id', 'payer_id'])]
class PayerPart
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: BudgetLine::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private BudgetLine $line;

    #[ORM\ManyToOne(targetEntity: Payer::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Payer $payer;

    #[ORM\Column(type: Types::BIGINT)]
    private string $value;

    public function __construct(BudgetLine $line, Payer $payer, int $value)
    {
        $this->id = Uuid::v7();
        $this->line = $line;
        $this->payer = $payer;
        $this->value = (string) $value;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getLine(): BudgetLine
    {
        return $this->line;
    }

    public function getPayer(): Payer
    {
        return $this->payer;
    }

    public function getValue(): int
    {
        return (int) $this->value;
    }
}
