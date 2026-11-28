<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** "Not now" on the switcher's company domain offer (sc-561): that organisation is not offered to this account again. */
#[ORM\Entity]
#[ORM\Table(name: 'join_offer_dismissals')]
#[ORM\UniqueConstraint(name: 'uniq_join_offer_dismissal', columns: ['user_id', 'organisation_id'])]
#[ORM\Index(name: 'idx_join_offer_dismissal_user', columns: ['user_id'])]
#[ORM\Index(name: 'idx_join_offer_dismissal_organisation', columns: ['organisation_id'])]
class JoinOfferDismissal
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $dismissedAt;

    public function __construct(User $user, Organisation $organisation, DateTimeImmutable $dismissedAt)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->organisation = $organisation;
        $this->dismissedAt = $dismissedAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getDismissedAt(): DateTimeImmutable
    {
        return $this->dismissedAt;
    }
}
