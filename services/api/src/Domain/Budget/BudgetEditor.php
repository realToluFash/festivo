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
use DateInterval;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

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

    public const string PUT_BACK = 'budget_line.put_back';

    /** Long enough for an Undo with no countdown (WCAG 2.2 SC 2.2.1's 20-hour exception), and no longer (GDPR Art. 5(1)(e)). */
    public const string LAPSE = 'P1D';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private BudgetLineRepository $budgetLineRepository,
        private LineRules $lineRules,
        private BudgetPublisher $budgetPublisher,
        private Auditor $auditor,
        private ClockInterface $clock,
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
            $line->remove($this->clock->now());
            $this->entityManager->flush();
        });
        $this->budgetPublisher->publish($event);
    }

    /** The same line in its place, for Undo: refused 404 once erased, and as a second staff-time line when the budget has one again. */
    public function putBack(Event $event, string $lineId, User $by): BudgetLine
    {
        $line = $this->stored($event, function () use ($event, $lineId, $by): BudgetLine {
            $line = $this->budgetLineRepository->findRemovedInEvent($event, $lineId) ?? throw ApiException::notFound('access.not_found');

            if (CostBasis::PerStaffHour === $line->getBasis() && null !== $this->budgetLineRepository->findStaffLine($event)) {
                throw ApiException::validation([$this->lineRules->staffLineTaken()]);
            }

            $line->putBack();
            $this->audit(self::PUT_BACK, $line, $by);

            return $line;
        });
        $this->budgetPublisher->publish($event);

        return $line;
    }

    public function eraseLapsed(): int
    {
        return $this->budgetLineRepository->eraseRemovedBefore($this->clock->now()->sub(new DateInterval(self::LAPSE)));
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
