<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Audit\Auditor;
use App\Domain\Budget\Model\ChosenSplit;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\Payer;
use App\Entity\PayerPart;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\PayerSplit;
use App\Http\Exception\ApiException;
use App\Repository\BudgetLineRepository;
use App\Repository\PayerPartRepository;
use App\Repository\PayerRepository;
use DateInterval;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * Each write takes the event's row lock, so the cap, a name and a split are checked against the payers the event has when it is stored.
 *
 * @phpstan-import-type SentPayer from PayerRules
 * @phpstan-import-type SentSplit from SplitRules
 */
final readonly class PayerEditor
{
    public const string ADDED = 'payer.added';

    public const string CHANGED = 'payer.changed';

    public const string REMOVED = 'payer.removed';

    public const string PUT_BACK = 'payer.put_back';

    public const string SPLIT_CHOSEN = 'budget_line.payers_chosen';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private PayerRepository $payerRepository,
        private PayerPartRepository $payerPartRepository,
        private BudgetLineRepository $budgetLineRepository,
        private PayerRules $payerRules,
        private SplitRules $splitRules,
        private QuantityResolver $quantityResolver,
        private BudgetPublisher $budgetPublisher,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    /** @param SentPayer $sent */
    public function add(Event $event, array $sent, User $by): Payer
    {
        $payer = Type\instance_of(Payer::class)->assert($this->locked($event, function () use ($event, $sent, $by): Payer {
            $this->refuseOverCap($event);
            $details = $this->payerRules->details($event, $sent, null);
            $payer = new Payer($event, $details->name, $details->note);
            $this->entityManager->persist($payer);
            $this->audit(self::ADDED, $payer, $by);

            return $payer;
        }));
        $this->budgetPublisher->publish($event);

        return $payer;
    }

    /** @param SentPayer $sent */
    public function change(Payer $payer, array $sent, User $by): Payer
    {
        $event = $payer->getEvent();
        $this->locked($event, function () use ($event, $payer, $sent, $by): Payer {
            $details = $this->payerRules->details($event, $sent, $payer);
            $payer->setName($details->name);
            $payer->setNote($details->note);
            $this->audit(self::CHANGED, $payer, $by);

            return $payer;
        });
        $this->budgetPublisher->publish($event);

        return $payer;
    }

    /** Refused while they cover any cost, naming those costs, so nobody's agreed split changes by itself. */
    public function remove(Payer $payer, User $by): void
    {
        $event = $payer->getEvent();
        $this->locked($event, function () use ($event, $payer, $by): Payer {
            $covered = $this->coveredBy($event, $payer);

            if ([] !== $covered) {
                throw new ApiException(
                    ErrorCode::PayerCoversCosts,
                    'budget.payer_covers_costs',
                    members: ['lineIds' => Vec\map($covered, static fn (BudgetLine $line): string => $line->getId()->toRfc4122()), 'count' => Iter\count($covered)],
                    parameters: ['name' => $payer->getName(), 'count' => Iter\count($covered)],
                );
            }

            foreach ($this->budgetLineRepository->findBy(['event' => $event]) as $line) {
                if ($line->isRemoved() && $this->names($line, $payer)) {
                    $this->clear($line);
                }
            }

            $this->audit(self::REMOVED, $payer, $by);
            $payer->setRemovedAt($this->clock->now());

            return $payer;
        });
        $this->budgetPublisher->publish($event);
    }

    public function putBack(Event $event, string $payerId, User $by): Payer
    {
        $payer = Type\instance_of(Payer::class)->assert($this->locked($event, function () use ($event, $payerId, $by): Payer {
            $payer = $this->payerRepository->findRemovedInEvent($event, $payerId) ?? throw ApiException::notFound('access.not_found');
            $this->refuseOverCap($event);
            $taken = $this->payerRules->nameTaken($event, $payer->getName(), $payer);

            if (null !== $taken) {
                throw ApiException::validation([$taken]);
            }

            $payer->setRemovedAt(null);
            $this->audit(self::PUT_BACK, $payer, $by);

            return $payer;
        }));
        $this->budgetPublisher->publish($event);

        return $payer;
    }

    /** @param SentSplit $sent */
    public function choose(Event $event, array $sent, User $by): void
    {
        $this->locked($event, function () use ($event, $sent, $by): Event {
            $chosen = $this->splitRules->split($event, $sent, $this->quantityResolver->factsFor($event));

            foreach ($chosen->lines as $line) {
                $this->clear($line);
                $this->entityManager->flush();
                $this->set($line, $chosen);
                $this->auditor->record(self::SPLIT_CHOSEN, 'BudgetLine', $line->getId(), Actor::User, $by->getId(), $by->getName());
            }

            return $event;
        });
        $this->budgetPublisher->publish($event);
    }

    public function eraseLapsed(): int
    {
        return $this->payerRepository->eraseRemovedBefore($this->clock->now()->sub(new DateInterval(BudgetEditor::LAPSE)));
    }

    /** @return list<BudgetLine> */
    public function coveredBy(Event $event, Payer $payer): array
    {
        $lines = Vec\filter($this->budgetLineRepository->findOnEvent($event), fn (BudgetLine $line): bool => $this->names($line, $payer));

        return Vec\sort($lines, static fn (BudgetLine $a, BudgetLine $b): int => PayerShares::categoryOrder($a) <=> PayerShares::categoryOrder($b));
    }

    private function names(BudgetLine $line, Payer $payer): bool
    {
        if (null === $line->getPayerSplit()) {
            return false;
        }

        return $line->getRestPayer() === $payer || Iter\any($this->payerPartRepository->findOnLine($line), static fn (PayerPart $part): bool => $part->getPayer() === $payer);
    }

    private function clear(BudgetLine $line): void
    {
        foreach ($this->payerPartRepository->findOnLine($line) as $part) {
            $this->entityManager->remove($part);
        }

        $line->setPayerSplit(null);
        $line->setRestPayer(null);
    }

    private function set(BudgetLine $line, ChosenSplit $chosen): void
    {
        if (null === $chosen->split) {
            return;
        }

        $line->setPayerSplit($chosen->split);
        $line->setRestPayer(PayerSplit::Fixed === $chosen->split ? $chosen->rest : null);

        foreach ($chosen->parts as $part) {
            $this->entityManager->persist(new PayerPart($line, $part['payer'], $part['value']));
        }
    }

    private function refuseOverCap(Event $event): void
    {
        if (Iter\count($this->payerRepository->findOnEvent($event)) >= Payer::PER_EVENT) {
            throw new ApiException(ErrorCode::PayerLimit, 'budget.payer_limit', parameters: ['{max}' => Payer::PER_EVENT]);
        }
    }

    /** @param callable(): (Payer|Event) $write */
    private function locked(Event $event, callable $write): Payer|Event
    {
        return $this->entityManager->wrapInTransaction(function () use ($event, $write): Payer|Event {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $done = $write();
            $this->entityManager->flush();

            return $done;
        });
    }

    private function audit(string $action, Payer $payer, User $by): void
    {
        $this->auditor->record($action, 'Payer', $payer->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
