<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Audit\Auditor;
use App\Entity\BudgetLine;
use App\Entity\BudgetMarkup;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\CostCategory;
use App\Repository\BudgetMarkupRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/** Markups and client prices (sc-92), under the event's row lock as every budget write is, so two markups set at once leave one row. */
final readonly class MarginEditor
{
    public const string MARKUP_SET = 'budget_markup.set';

    public const string MARKUP_CLEARED = 'budget_markup.cleared';

    public const string LINE_CHARGED = 'budget_line.charged';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private BudgetMarkupRepository $budgetMarkupRepository,
        private BudgetPublisher $budgetPublisher,
        private Auditor $auditor,
    ) {
    }

    /** The event's markup with no category; null clears it. */
    public function setMarkup(Event $event, ?CostCategory $category, ?int $tenths, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $category, $tenths, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $held = $this->budgetMarkupRepository->findFor($event, $category);

            if (null === $tenths) {
                if (null !== $held) {
                    $this->auditor->record(self::MARKUP_CLEARED, 'BudgetMarkup', $held->getId(), Actor::User, $by->getId(), $by->getName());
                    $this->entityManager->remove($held);
                }
            } else {
                if (null === $held) {
                    $held = new BudgetMarkup($event, $category, $tenths);
                    $this->entityManager->persist($held);
                } else {
                    $held->setMarkupTenths($tenths);
                }

                $this->auditor->record(self::MARKUP_SET, 'BudgetMarkup', $held->getId(), Actor::User, $by->getId(), $by->getName());
            }

            $this->entityManager->flush();
        });
        $this->budgetPublisher->publish($event);
    }

    /** A markup of the line's own or a price of its own, never both; neither takes the category's or the event's again. */
    public function charge(BudgetLine $line, ?int $markupTenths, ?int $priceMinor, User $by): void
    {
        $event = $line->getEvent();
        $this->entityManager->wrapInTransaction(function () use ($event, $line, $markupTenths, $priceMinor, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            match (true) {
                null !== $priceMinor => $line->chargeAt($priceMinor),
                null !== $markupTenths => $line->chargeWithMarkup($markupTenths),
                default => $line->chargeAsMarkedUp(),
            };
            $this->auditor->record(self::LINE_CHARGED, 'BudgetLine', $line->getId(), Actor::User, $by->getId(), $by->getName());
            $this->entityManager->flush();
        });
        $this->budgetPublisher->publish($event);
    }
}
