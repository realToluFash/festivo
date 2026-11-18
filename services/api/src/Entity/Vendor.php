<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\VendorCategory;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Somebody an organisation buys from (sc-82): a record kept about them, not an account they hold. Archived, never deleted. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'vendors')]
#[ORM\Index(name: 'idx_vendor_organisation', columns: ['organisation_id'])]
class Vendor
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 100)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: VendorCategory::class)]
    private VendorCategory $category;

    #[ORM\Column(type: Types::STRING, length: 100, nullable: true)]
    private ?string $contactName = null;

    #[ORM\Column(type: Types::STRING, length: 254, nullable: true)]
    private ?string $emailAddress = null;

    /** E.164, beside the country it was typed for. */
    #[ORM\Column(type: Types::STRING, length: 20, nullable: true)]
    private ?string $phoneNumber = null;

    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $phoneCountryCode = null;

    #[ORM\Column(type: Types::STRING, length: 2048, nullable: true)]
    private ?string $website = null;

    #[ORM\Column(type: Types::STRING, length: 300, nullable: true)]
    private ?string $address = null;

    #[ORM\Column(type: Types::STRING, length: 1000, nullable: true)]
    private ?string $note = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $archivedAt = null;

    public function __construct(Organisation $organisation, string $name, VendorCategory $category)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->name = $name;
        $this->category = $category;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getCategory(): VendorCategory
    {
        return $this->category;
    }

    public function setCategory(VendorCategory $category): void
    {
        $this->category = $category;
    }

    public function getContactName(): ?string
    {
        return $this->contactName;
    }

    public function setContactName(?string $contactName): void
    {
        $this->contactName = $contactName;
    }

    public function getEmailAddress(): ?string
    {
        return $this->emailAddress;
    }

    public function setEmailAddress(?string $emailAddress): void
    {
        $this->emailAddress = $emailAddress;
    }

    public function getPhoneNumber(): ?string
    {
        return $this->phoneNumber;
    }

    public function getPhoneCountryCode(): ?string
    {
        return $this->phoneCountryCode;
    }

    public function setPhone(?string $phoneNumber, ?string $phoneCountryCode): void
    {
        $this->phoneNumber = $phoneNumber;
        $this->phoneCountryCode = $phoneCountryCode;
    }

    public function getWebsite(): ?string
    {
        return $this->website;
    }

    public function setWebsite(?string $website): void
    {
        $this->website = $website;
    }

    public function getAddress(): ?string
    {
        return $this->address;
    }

    public function setAddress(?string $address): void
    {
        $this->address = $address;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function setNote(?string $note): void
    {
        $this->note = $note;
    }

    public function getArchivedAt(): ?DateTimeImmutable
    {
        return $this->archivedAt;
    }

    public function setArchivedAt(?DateTimeImmutable $archivedAt): void
    {
        $this->archivedAt = $archivedAt;
    }
}
