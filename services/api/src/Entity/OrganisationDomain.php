<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A domain whose people may ask to join (sc-561). Several organisations may list one, unless one has proved it under Email domains (sc-560). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'organisation_domains')]
#[ORM\UniqueConstraint(name: 'uniq_organisation_domain', columns: ['organisation_id', 'domain'])]
#[ORM\Index(name: 'idx_organisation_domain_organisation', columns: ['organisation_id'])]
#[ORM\Index(name: 'idx_organisation_domain_domain', columns: ['domain'])]
class OrganisationDomain
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    /** Lowercase, as DomainNameNormaliser writes it. */
    #[ORM\Column(type: Types::STRING, length: 253)]
    private string $domain;

    public function __construct(Organisation $organisation, string $domain)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->domain = $domain;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getDomain(): string
    {
        return $this->domain;
    }
}
