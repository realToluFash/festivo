<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\Members\JoinRequests;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every minute: removes each request nobody answered as of its own instant, and tells the people deciding of new ones. */
#[AsCommand(name: 'app:join-requests:run', description: 'Remove the requests to join nobody answered within 30 days, and email who decides about new ones')]
final readonly class RunJoinRequestsCommand
{
    public function __construct(
        private JoinRequests $joinRequests,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Removed %d requests to join that nobody answered.', $this->joinRequests->expireDue()));
        $io->writeln(Str\format('Told %d organisations of requests waiting.', $this->joinRequests->noticeDue()));

        return Command::SUCCESS;
    }
}
