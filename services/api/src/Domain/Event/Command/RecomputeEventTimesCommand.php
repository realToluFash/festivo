<?php

declare(strict_types=1);

namespace App\Domain\Event\Command;

use App\Domain\Event\EventTimesRecomputer;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:recompute-event-times', description: 'Re-derive the UTC times of events not yet over, after an update that changed tzdata')]
final readonly class RecomputeEventTimesCommand
{
    public function __construct(
        private EventTimesRecomputer $eventTimesRecomputer,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count the events whose UTC times would change, and write nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format('Would recompute the UTC times of %d events.', $this->eventTimesRecomputer->recompute(write: false)));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format('Recomputed the UTC times of %d events.', $this->eventTimesRecomputer->recompute()));

        return Command::SUCCESS;
    }
}
