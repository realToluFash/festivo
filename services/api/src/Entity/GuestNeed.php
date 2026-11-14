<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\NeedKind;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One code a guest or a companion needs (sc-3777), a row so the counts and the filter query it and erasure deletes it with them. Each Other's words are on the Guest. */
#[ORM\Entity]
#[ORM\Table(name: 'guest_needs')]
#[ORM\UniqueConstraint(name: 'uniq_guest_need', columns: ['guest_id', 'kind', 'code'])]
class GuestNeed
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Guest $guest;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: NeedKind::class)]
    private NeedKind $kind;

    #[ORM\Column(type: Types::STRING, length: 32)]
    private string $code;

    public function __construct(Guest $guest, NeedKind $kind, string $code)
    {
        $this->id = Uuid::v7();
        $this->guest = $guest;
        $this->kind = $kind;
        $this->code = $code;
    }

    public function getGuest(): Guest
    {
        return $this->guest;
    }

    public function getKind(): NeedKind
    {
        return $this->kind;
    }

    public function getCode(): string
    {
        return $this->code;
    }
}
