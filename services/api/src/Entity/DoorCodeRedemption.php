<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One account's use of a door code (sc-72): what the use cap counts, and what keeps a removal from being undone by the same code. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'door_code_redemptions')]
#[ORM\UniqueConstraint(name: 'uniq_door_code_redemption', columns: ['door_code_id', 'user_id'])]
#[ORM\Index(name: 'idx_door_code_redemption_user', columns: ['user_id'])]
class DoorCodeRedemption
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: DoorCode::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private DoorCode $doorCode;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    /** The name given at the door, which the account may later change. */
    #[ORM\Column(type: Types::STRING, length: 720)]
    private string $name;

    public function __construct(DoorCode $doorCode, User $user, string $name)
    {
        $this->id = Uuid::v7();
        $this->doorCode = $doorCode;
        $this->user = $user;
        $this->name = $name;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getDoorCode(): DoorCode
    {
        return $this->doorCode;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getName(): string
    {
        return $this->name;
    }
}
