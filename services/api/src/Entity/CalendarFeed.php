<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * One person's subscription link to one organisation's calendar (sc-3626). The link's token is never stored: the seed it is signed from is, with the token's SHA-256 to find the row by. Rows are made only by FeedLinkIssuer's insert, which two first asks at once must agree on.
 */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'calendar_feeds')]
#[ORM\UniqueConstraint(name: 'uniq_calendar_feed_token_hash', columns: ['token_hash'])]
#[ORM\UniqueConstraint(name: 'uniq_calendar_feed_member', columns: ['user_id', 'organisation_id'])]
class CalendarFeed
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $seed;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

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

    public function getSeed(): string
    {
        return $this->seed;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }

    /** The seed and the hash change together, so no row holds a link that resolves to nothing. */
    public function reissue(string $seed, string $tokenHash): void
    {
        $this->seed = $seed;
        $this->tokenHash = $tokenHash;
    }
}
