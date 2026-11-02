<?php

declare(strict_types=1);

namespace App\Realtime\Command;

use App\Enum\RealtimeTopic;
use Psl\Dict;
use Psl\Json;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:realtime:topics',
    description: 'Print the declared Mercure topics as JSON, which @soirely/api-client generates its copy from',
)]
final readonly class RealtimeTopicsCommand
{
    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Json\encode(Dict\pull(
            RealtimeTopic::cases(),
            static fn (RealtimeTopic $topic): string => $topic->value,
            static fn (RealtimeTopic $topic): string => $topic->name,
        )));

        return Command::SUCCESS;
    }
}
