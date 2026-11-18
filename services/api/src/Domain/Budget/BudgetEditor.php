<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Audit\Auditor;
use App\Domain\Budget\Model\LineDetails;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\CostBasis;
use App\Http\Exception\ApiException;
use App\Repository\BudgetLineRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Each write takes the event's row lock, the one Edit details takes, so a price is checked against the currency the event has when it is stored.
 *
 * @phpstan-import-type Sent from LineRules
 */
final readonly class BudgetEditor
{
    public const string ADDED = 'budget_line.added';

    public const string CHANGED = 'budget_line.changed';

    public const string REMOVED = 'budget_line.removed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private BudgetLineRepository $budgetLineRepository,
        private LineRules $lineRules,
        private BudgetPublisher $budgetPublisher,
        private Auditor $auditor,
    ) {
    }

    /** @param Sent $sent */
    public function add(Event $event, array $sent, User $by): BudgetLine
    {
        $line = $this->stored($event, function () use ($event, $sent, $by): BudgetLine {
            $details = $this->checked($event, $sent, null);
            $line = new BudgetLine($event, $details->label, $details->category, $details->basis, $details->priceMinor, $details->note);
            $this->entityManager->persist($line);
            $this->audit(self::ADDED, $line, $by);

            return $line;
        });
        $this->budgetPublisher->publish($event);

        return $line;
    }

    /** @param Sent $sent the whole line */
    public function change(BudgetLine $line, array $sent, User $by): BudgetLine
    {
        $event = $line->getEvent();
        $this->stored($event, function () use ($event, $line, $sent, $by): BudgetLine {
            $details = $this->checked($event, $sent, $line);
            $line->setLabel($details->label);
            $line->setCategory($details->category);
            $line->setBasis($details->basis);
            $line->setPriceMinor($details->priceMinor);
            $line->setNote($details->note);
            $this->audit(self::CHANGED, $line, $by);

            return $line;
        });
        $this->budgetPublisher->publish($event);

        return $line;
    }

    public function remove(BudgetLine $line, User $by): void
    {
        $event = $line->getEvent();
        $this->entityManager->wrapInTransaction(function () use ($event, $line, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $this->audit(self::REMOVED, $line, $by);
            $this->entityManager->remove($line);
            $this->entityManager->flush();
        });
        $this->budgetPublisher->publish($event);
    }

    /** @param Sent $sent */
    private function checked(Event $event, array $sent, ?BudgetLine $besides): LineDetails
    {
        $details = $this->lineRules->details($sent, $event->getCurrency());

        if (CostBasis::PerStaffHour === $details->basis) {
            $held = $this->budgetLineRepository->findStaffLine($event);

            if (null !== $held && $held !== $besides) {
                throw ApiException::validation([$this->lineRules->staffLineTaken()]);
            }
        }

        return $details;
    }

    /** @param callable(): BudgetLine $write */
    private function stored(Event $event, callable $write): BudgetLine
    {
        try {
            return $this->entityManager->wrapInTransaction(function () use ($event, $write): BudgetLine {
                $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
                $line = $write();
                $this->entityManager->flush();

                return $line;
            });
        } catch (UniqueConstraintViolationException) {
            throw ApiException::validation([$this->lineRules->staffLineTaken()]);
        }
    }

    private function audit(string $action, BudgetLine $line, User $by): void
    {
        $this->auditor->record($action, 'BudgetLine', $line->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
