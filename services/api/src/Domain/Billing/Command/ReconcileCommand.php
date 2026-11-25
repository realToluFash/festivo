<?php

declare(strict_types=1);

namespace App\Domain\Billing\Command;

use App\Domain\Billing\Interfaces\PaymentProviderInterface;
use App\Entity\Subscription;
use App\Repository\SubscriptionRepository;
use Psl\Iter;
use Psl\Str;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Throwable;

/** Nightly: every paying subscription against what the provider holds, and the events it gave up delivering. It reports to ops and never corrects (sc-3933). */
#[AsCommand(name: 'app:billing:reconcile', description: 'Compare each paying subscription with the provider and report any difference')]
final readonly class ReconcileCommand
{
    public function __construct(
        private SubscriptionRepository $subscriptionRepository,
        private PaymentProviderInterface $paymentProvider,
        private LoggerInterface $logger,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $differences = 0;

        foreach ($this->subscriptionRepository->findPaying() as $subscription) {
            try {
                $difference = $this->difference($subscription);
            } catch (Throwable $exception) {
                $difference = 'the provider could not be read: ' . $exception->getMessage();
            }

            if (null !== $difference) {
                ++$differences;
                $this->logger->critical(Str\format('Billing reconciliation: subscription %s differs from the provider, %s.', $subscription->getId()->toRfc4122(), $difference));
            }
        }

        try {
            $undelivered = $this->paymentProvider->undeliveredEvents();
        } catch (Throwable $exception) {
            $undelivered = [];
            $this->logger->critical('Billing reconciliation: the provider\'s undelivered events could not be read.', ['exception' => $exception]);
        }

        foreach ($undelivered as $notification) {
            $this->logger->critical(Str\format('Billing: the provider gave up delivering %s after its last retry.', $notification));
        }

        $io->writeln(Str\format('%d differences, %d undelivered events.', $differences, Iter\count($undelivered)));

        return Command::SUCCESS;
    }

    private function difference(Subscription $subscription): ?string
    {
        $held = $this->paymentProvider->subscriptionState($subscription);

        return match (true) {
            null === $held => 'the provider holds no such subscription',
            $held->plan !== $subscription->getPlan() => Str\format('plan %s here, %s there', $subscription->getPlan()->value, $held->plan->value),
            $held->status !== $subscription->getStatus() => Str\format('status %s here, %s there', $subscription->getStatus()->value, $held->status->value),
            null !== $held->periodEnd && $held->periodEnd->getTimestamp() !== $subscription->getPeriodEnd()?->getTimestamp() => 'the period end differs',
            default => null,
        };
    }
}
