<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One device's hold on a request (sc-509): the request is the account's, so another device opening it adds a handle. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'two_factor_recovery_handles')]
#[ORM\UniqueConstraint(name: 'uniq_two_factor_recovery_handle_hash', columns: ['token_hash'])]
#[ORM\Index(name: 'idx_two_factor_recovery_handle_recovery', columns: ['recovery_id'])]
class TwoFactorRecoveryHandle
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: TwoFactorRecovery::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private TwoFactorRecovery $recovery;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    public function __construct(TwoFactorRecovery $recovery, string $tokenHash)
    {
        $this->id = Uuid::v7();
        $this->recovery = $recovery;
        $this->tokenHash = $tokenHash;
    }

    public function getRecovery(): TwoFactorRecovery
    {
        return $this->recovery;
    }
}
