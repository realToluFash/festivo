<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\StaffPay;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A job's pay on one event, or one person's own instead of their job's (sc-101), in the event's currency, which it holds while it exists. Set only on Budget / Staff rates. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_rates')]
#[ORM\Index(name: 'idx_staff_rate_event', columns: ['event_id'])]
#[ORM\UniqueConstraint(name: 'uniq_staff_rate_job', columns: ['job_id'], options: ['where' => '(job_id IS NOT NULL)'])]
#[ORM\UniqueConstraint(name: 'uniq_staff_rate_person', columns: ['person_id'], options: ['where' => '(person_id IS NOT NULL)'])]
class StaffRate
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** Exactly one of the job and the person, which the migration's CHECK holds. */
    #[ORM\ManyToOne(targetEntity: StaffJob::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?StaffJob $job;

    #[ORM\ManyToOne(targetEntity: StaffMember::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?StaffMember $person;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: StaffPay::class)]
    private StaffPay $pay;

    /** In the currency's minor unit: an hour's rate, or the fee for each person. */
    #[ORM\Column(type: Types::BIGINT)]
    private string $amountMinor;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $setBy;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $setAt;

    private function __construct(Event $event, ?StaffJob $job, ?StaffMember $person, StaffPay $pay, int $amountMinor, User $by, DateTimeImmutable $at)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->job = $job;
        $this->person = $person;
        $this->pay = $pay;
        $this->amountMinor = (string) $amountMinor;
        $this->setBy = $by;
        $this->setAt = $at;
    }

    public static function forJob(StaffJob $job, StaffPay $pay, int $amountMinor, User $by, DateTimeImmutable $at): self
    {
        return new self($job->getEvent(), $job, null, $pay, $amountMinor, $by, $at);
    }

    public static function forPerson(StaffMember $person, StaffPay $pay, int $amountMinor, User $by, DateTimeImmutable $at): self
    {
        return new self($person->getEvent(), null, $person, $pay, $amountMinor, $by, $at);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getJob(): ?StaffJob
    {
        return $this->job;
    }

    public function getPerson(): ?StaffMember
    {
        return $this->person;
    }

    public function getPay(): StaffPay
    {
        return $this->pay;
    }

    public function getAmountMinor(): int
    {
        return (int) $this->amountMinor;
    }

    public function getSetBy(): ?User
    {
        return $this->setBy;
    }

    public function getSetAt(): DateTimeImmutable
    {
        return $this->setAt;
    }

    public function set(StaffPay $pay, int $amountMinor, User $by, DateTimeImmutable $at): void
    {
        $this->pay = $pay;
        $this->amountMinor = (string) $amountMinor;
        $this->setBy = $by;
        $this->setAt = $at;
    }
}
