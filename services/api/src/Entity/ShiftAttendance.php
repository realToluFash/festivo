<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** When one person on one shift actually started and stopped (sc-234); a correction is kept beside what was recorded, never over it. */
#[ORM\Entity]
#[ORM\Table(name: 'shift_attendances')]
#[ORM\UniqueConstraint(name: 'uniq_shift_attendance', columns: ['shift_id', 'staff_member_id'])]
class ShiftAttendance
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: StaffShift::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private StaffShift $shift;

    #[ORM\ManyToOne(targetEntity: StaffMember::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private StaffMember $staffMember;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $clockedInAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $clockedOutAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $correctedInAt = null;

    #[ORM\Column(length: 160, nullable: true)]
    private ?string $inCorrectedBy = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $inCorrectedOn = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $correctedOutAt = null;

    #[ORM\Column(length: 160, nullable: true)]
    private ?string $outCorrectedBy = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $outCorrectedOn = null;

    public function __construct(StaffShift $shift, StaffMember $staffMember)
    {
        $this->id = Uuid::v7();
        $this->shift = $shift;
        $this->staffMember = $staffMember;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getShift(): StaffShift
    {
        return $this->shift;
    }

    public function getStaffMember(): StaffMember
    {
        return $this->staffMember;
    }

    public function getClockedInAt(): ?DateTimeImmutable
    {
        return $this->clockedInAt;
    }

    public function getClockedOutAt(): ?DateTimeImmutable
    {
        return $this->clockedOutAt;
    }

    public function clockIn(DateTimeImmutable $at): void
    {
        $this->clockedInAt = $at;
    }

    public function clockOut(DateTimeImmutable $at): void
    {
        $this->clockedOutAt = $at;
    }

    /** The clock-in that counts: the correction, else what was recorded. */
    public function countedIn(): ?DateTimeImmutable
    {
        return $this->correctedInAt ?? $this->clockedInAt;
    }

    public function countedOut(): ?DateTimeImmutable
    {
        return $this->correctedOutAt ?? $this->clockedOutAt;
    }

    public function getCorrectedInAt(): ?DateTimeImmutable
    {
        return $this->correctedInAt;
    }

    public function getInCorrectedBy(): ?string
    {
        return $this->inCorrectedBy;
    }

    public function getInCorrectedOn(): ?DateTimeImmutable
    {
        return $this->inCorrectedOn;
    }

    public function getCorrectedOutAt(): ?DateTimeImmutable
    {
        return $this->correctedOutAt;
    }

    public function getOutCorrectedBy(): ?string
    {
        return $this->outCorrectedBy;
    }

    public function getOutCorrectedOn(): ?DateTimeImmutable
    {
        return $this->outCorrectedOn;
    }

    /** Null `$at` withdraws the correction: the time is back to what was recorded. */
    public function correctIn(?DateTimeImmutable $at, string $by, DateTimeImmutable $on): void
    {
        $this->correctedInAt = $at;
        $this->inCorrectedBy = null === $at ? null : $by;
        $this->inCorrectedOn = null === $at ? null : $on;
    }

    public function correctOut(?DateTimeImmutable $at, string $by, DateTimeImmutable $on): void
    {
        $this->correctedOutAt = $at;
        $this->outCorrectedBy = null === $at ? null : $by;
        $this->outCorrectedOn = null === $at ? null : $on;
    }
}
