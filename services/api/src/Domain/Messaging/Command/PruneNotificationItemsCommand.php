<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Command;

use App\Domain\Messaging\NotificationItemPruner;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:prune-notification-items', description: 'Delete bell items older than the 90 days the bell keeps')]
final readonly class PruneNotificationItemsCommand
{
    public function __construct(
        private NotificationItemPruner $notificationItemPruner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count what would be deleted, and delete nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format('Would delete %d bell items.', $this->notificationItemPruner->countPrunable()));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format(
            'Deleted %d bell items, in batches of %d.',
            $this->notificationItemPruner->prune(),
            NotificationItemPruner::BATCH_SIZE,
        ));

        return Command::SUCCESS;
    }
}
