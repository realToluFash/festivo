<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Audit\Auditor;
use App\Domain\Budget\Model\PayRate;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffRate;
use App\Entity\User;
use App\Enum\Actor;
use App\Http\Exception\ApiException;
use App\Repository\StaffRateRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Sets and removes a job's rate or a person's own (sc-101), each change audited with who made it and what it was. The event is locked first, as a budget line's change locks it, so a currency change cannot slip between. */
final readonly class StaffRateEditor
{
    public const string SET = 'staff_rate.set';

    public const string REMOVED = 'staff_rate.removed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffRateRepository $staffRateRepository,
        private StaffRateRules $staffRateRules,
        private BudgetPublisher $budgetPublisher,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    public function setForJob(StaffJob $job, PayRate $rate, User $by): void
    {
        $this->changed($job->getEvent(), fn (): ?StaffRate => $this->staffRateRepository->findOfJob($job), fn (): StaffRate => StaffRate::forJob($job, $rate->pay, $rate->minor, $by, $this->clock->now()), $rate, $by);
    }

    public function setForPerson(StaffMember $person, PayRate $rate, User $by): void
    {
        if (null === $person->getJob()) {
            throw ApiException::validation([$this->staffRateRules->noJob()]);
        }

        $this->changed($person->getEvent(), fn (): ?StaffRate => $this->staffRateRepository->findOfPerson($person), fn (): StaffRate => StaffRate::forPerson($person, $rate->pay, $rate->minor, $by, $this->clock->now()), $rate, $by);
    }

    public function removeForJob(StaffJob $job, User $by): void
    {
        $this->removed($job->getEvent(), fn (): ?StaffRate => $this->staffRateRepository->findOfJob($job), $by);
    }

    public function removeForPerson(StaffMember $person, User $by): void
    {
        $this->removed($person->getEvent(), fn (): ?StaffRate => $this->staffRateRepository->findOfPerson($person), $by);
    }

    /**
     * @param callable(): ?StaffRate $held
     * @param callable(): StaffRate  $made
     */
    private function changed(Event $event, callable $held, callable $made, PayRate $rate, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $held, $made, $rate, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $stored = $held();
            $was = null === $stored ? null : [$stored->getPay()->value, $stored->getAmountMinor()];

            if (null === $stored) {
                $stored = $made();
                $this->entityManager->persist($stored);
            } else {
                $stored->set($rate->pay, $rate->minor, $by, $this->clock->now());
            }

            $this->auditor->record(self::SET, 'StaffRate', $stored->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(
                null === $was ? [] : ['pay' => $was[0], 'amountMinor' => $was[1]],
                ['pay' => $rate->pay->value, 'amountMinor' => $rate->minor],
            ));
            $this->entityManager->flush();
        });
        $this->budgetPublisher->publish($event);
    }

    /** @param callable(): ?StaffRate $held */
    private function removed(Event $event, callable $held, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $held, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $stored = $held();

            if (null === $stored) {
                return;
            }

            $this->auditor->record(self::REMOVED, 'StaffRate', $stored->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(
                ['pay' => $stored->getPay()->value, 'amountMinor' => $stored->getAmountMinor()],
                [],
            ));
            $this->entityManager->remove($stored);
            $this->entityManager->flush();
        });
        $this->budgetPublisher->publish($event);
    }
}
