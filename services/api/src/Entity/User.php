<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\SoftDeletable;
use App\Doctrine\Traits\Timestampable;
use App\Enum\AccountOrigin;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'users')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    use SoftDeletable;
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $passwordHash = null;

    #[ORM\Column(type: Types::STRING, length: 180)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 180, nullable: true)]
    private ?string $businessName = null;

    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $countryCode = null;

    #[ORM\Column(type: Types::STRING, length: 8, nullable: true)]
    private ?string $locale = null;

    /** Set once, at creation: it is what tells an account that founds an organisation from one that joins. */
    #[ORM\Column(type: Types::STRING, length: 20, enumType: AccountOrigin::class)]
    private AccountOrigin $origin;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $detailsSavedAt = null;

    /** @var Collection<int, EmailAddress> */
    #[ORM\OneToMany(targetEntity: EmailAddress::class, mappedBy: 'user', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $emailAddresses;

    /** @var Collection<int, PhoneNumber> */
    #[ORM\OneToMany(targetEntity: PhoneNumber::class, mappedBy: 'user', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $phoneNumbers;

    public function __construct(
        string $name,
        ?string $passwordHash = null,
        AccountOrigin $origin = AccountOrigin::SelfRegistered,
    ) {
        $this->id = Uuid::v7();
        $this->origin = $origin;
        $this->name = $name;
        $this->passwordHash = $passwordHash;
        $this->emailAddresses = new ArrayCollection();
        $this->phoneNumbers = new ArrayCollection();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrigin(): AccountOrigin
    {
        return $this->origin;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getBusinessName(): ?string
    {
        return $this->businessName;
    }

    public function setBusinessName(?string $businessName): void
    {
        $this->businessName = $businessName;
    }

    public function getCountryCode(): ?string
    {
        return $this->countryCode;
    }

    public function setCountryCode(?string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    public function getLocale(): ?string
    {
        return $this->locale;
    }

    public function setLocale(?string $locale): void
    {
        $this->locale = $locale;
    }

    public function setPassword(?string $passwordHash): void
    {
        $this->passwordHash = $passwordHash;
    }

    public function getPassword(): ?string
    {
        return $this->passwordHash;
    }

    /** @return list<EmailAddress> */
    public function getEmailAddresses(): array
    {
        return $this->emailAddresses->getValues();
    }

    public function addEmailAddress(EmailAddress $emailAddress): void
    {
        if (!$this->emailAddresses->contains($emailAddress)) {
            $this->emailAddresses->add($emailAddress);
        }
    }

    public function getPrimaryEmailAddress(): ?EmailAddress
    {
        foreach ($this->emailAddresses as $emailAddress) {
            if ($emailAddress->isPrimary()) {
                return $emailAddress;
            }
        }

        return null;
    }

    /** @return list<PhoneNumber> */
    public function getPhoneNumbers(): array
    {
        return $this->phoneNumbers->getValues();
    }

    public function addPhoneNumber(PhoneNumber $phoneNumber): void
    {
        if (!$this->phoneNumbers->contains($phoneNumber)) {
            $this->phoneNumbers->add($phoneNumber);
        }
    }

    public function removePhoneNumber(PhoneNumber $phoneNumber): void
    {
        $this->phoneNumbers->removeElement($phoneNumber);
    }

    public function getPrimaryPhoneNumber(): ?PhoneNumber
    {
        foreach ($this->phoneNumbers as $phoneNumber) {
            if ($phoneNumber->isPrimary()) {
                return $phoneNumber;
            }
        }

        return null;
    }

    public function getPendingPhoneNumber(): ?PhoneNumber
    {
        foreach ($this->phoneNumbers as $phoneNumber) {
            if ($phoneNumber->isPending()) {
                return $phoneNumber;
            }
        }

        return null;
    }

    /** The number a code is waiting on: a replacement texted, else the primary. */
    public function getPhoneNumberAwaitingCode(): ?PhoneNumber
    {
        return $this->getPendingPhoneNumber() ?? $this->getPrimaryPhoneNumber();
    }

    /** Whether this account ever proved it owns an address: one that never did can be released and deleted. */
    public function hasVerifiedEmailAddress(): bool
    {
        foreach ($this->emailAddresses as $address) {
            if ($address->isVerified()) {
                return true;
            }
        }

        return false;
    }

    /**
     * An absent phone is acceptable. A gate written as "the phone must be
     * verified" locks out everyone who signed in with a provider, because
     * those accounts legitimately have no phone.
     */
    public function isVerified(): bool
    {
        $email = $this->getPrimaryEmailAddress();

        if (null === $email || !$email->isVerified()) {
            return false;
        }

        $phone = $this->getPrimaryPhoneNumber();

        return null === $phone || $phone->isVerified();
    }

    /** Set the first time the details screen is saved; "complete" needs it once (sc-57). */
    public function hasSavedDetails(): bool
    {
        return null !== $this->detailsSavedAt;
    }

    public function markDetailsSaved(): void
    {
        $this->detailsSavedAt ??= new DateTimeImmutable();
    }

    /**
     * The id, not an address. A person may link several addresses and change
     * which one is primary, so an address is not a stable name for an account —
     * and this value is what goes in the access token.
     */
    public function getUserIdentifier(): string
    {
        return $this->id->toRfc4122();
    }

    public function getRoles(): array
    {
        return ['ROLE_USER'];
    }

    public function eraseCredentials(): void
    {
    }
}
