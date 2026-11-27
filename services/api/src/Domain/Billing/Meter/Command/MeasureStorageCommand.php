<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Command;

use App\Domain\Billing\Meter\StorageMeasurer;
use App\Repository\SubscriptionRepository;
use Psl\Str;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Uid\Uuid;

#[AsCommand(name: 'app:usage:measure-storage', description: 'Measure every organisation\'s storage, or the one named, and record it as today\'s measurement (sc-90252)')]
final readonly class MeasureStorageCommand
{
    public function __construct(
        private StorageMeasurer $storageMeasurer,
        private SubscriptionRepository $subscriptionRepository,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'An organisation id; every organisation when left out')]
        string $organisation = '',
    ): int {
        if ('' === $organisation) {
            $io->writeln(Str\format('Measured the storage of %d organisations.', $this->storageMeasurer->measureAll()));

            return Command::SUCCESS;
        }

        if (!Uuid::isValid($organisation)) {
            $io->error('Give an organisation id.');

            return Command::INVALID;
        }

        $organisationId = Uuid::fromString($organisation);

        if (null === $this->subscriptionRepository->findOneBy(['organisation' => $organisationId])) {
            $io->error('No organisation has that id.');

            return Command::INVALID;
        }

        $io->writeln(Str\format('Measured %d bytes.', $this->storageMeasurer->measure($organisationId)));

        return Command::SUCCESS;
    }
}
