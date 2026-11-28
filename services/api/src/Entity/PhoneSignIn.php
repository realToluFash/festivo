<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** A number signing in by phone code (sc-4235): the code hangs here, so no account exists until it is proved. The handle is kept only as its SHA-256. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'phone_sign_ins')]
#[ORM\UniqueConstraint(name: 'uniq_phone_sign_in_handle', columns: ['handle_hash'])]
#[ORM\Index(name: 'idx_phone_sign_in_number', columns: ['number'])]
class PhoneSignIn implements TextableContact
{
    use Timestampable;

    public const int LIFETIME_HOURS = 24;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $handleHash;

    /** E.164. */
    #[ORM\Column(type: Types::STRING, length: 32)]
    private string $number;

    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $countryCode;

    #[ORM\ManyToOne(targetEntity: StaffMember::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?StaffMember $staffMember;

    #[ORM\ManyToOne(targetEntity: DoorCode::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?DoorCode $doorCode;

    /** The name typed at a door code, for an account the code makes; never kept on an existing one. */
    #[ORM\Column(type: Types::STRING, length: 720, nullable: true)]
    private ?string $typedName;

    #[ORM\Column(type: Types::STRING, length: 8)]
    private string $locale;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $codesByText = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $provedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $openUntil;

    private function __construct(string $handleHash, string $number, ?string $countryCode, ?StaffMember $staffMember, ?DoorCode $doorCode, ?string $typedName, string $locale, DateTimeImmutable $now)
    {
        $this->openUntil = $now->modify('+' . self::LIFETIME_HOURS . ' hours');
        $this->id = Uuid::v7();
        $this->handleHash = $handleHash;
        $this->number = $number;
        $this->countryCode = $countryCode;
        $this->staffMember = $staffMember;
        $this->doorCode = $doorCode;
        $this->typedName = $typedName;
        $this->locale = $locale;
    }

    public static function throughLink(#[SensitiveParameter] string $handleHash, StaffMember $entry, string $number, ?string $countryCode, string $locale, DateTimeImmutable $now): self
    {
        return new self($handleHash, $number, $countryCode, $entry, null, null, $locale, $now);
    }

    public static function throughDoorCode(#[SensitiveParameter] string $handleHash, DoorCode $doorCode, string $number, ?string $countryCode, string $typedName, string $locale, DateTimeImmutable $now): self
    {
        return new self($handleHash, $number, $countryCode, null, $doorCode, $typedName, $locale, $now);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getNumber(): string
    {
        return $this->number;
    }

    public function getCountryCode(): ?string
    {
        return $this->countryCode;
    }

    public function getStaffMember(): ?StaffMember
    {
        return $this->staffMember;
    }

    public function getDoorCode(): ?DoorCode
    {
        return $this->doorCode;
    }

    public function getTypedName(): ?string
    {
        return $this->typedName;
    }

    public function getLocale(): string
    {
        return $this->locale;
    }

    public function isVerified(): bool
    {
        return null !== $this->provedAt;
    }

    public function setVerifiedAt(?DateTimeImmutable $verifiedAt): void
    {
        $this->provedAt = $verifiedAt;
    }

    /** Once proved: an account made from it now holds the name, and an existing account never takes it. */
    public function forgetTypedName(): void
    {
        $this->typedName = null;
    }

    public function isOpenAt(DateTimeImmutable $now): bool
    {
        return null === $this->provedAt && $now < $this->openUntil;
    }

    public function wantsCodesByText(): bool
    {
        return $this->codesByText;
    }

    public function chooseCodesByText(): void
    {
        $this->codesByText = true;
    }
}
