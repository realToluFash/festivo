<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\AuditLog\AuditExports;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every minute: an audit log export whose try stopped without finishing, in a restart, a crash or a killed worker, is tried again, up to its last try. */
#[AsCommand(name: 'app:audit-exports:prepare', description: 'Try again each audit log export still preparing whose latest try has not been seen working for five minutes')]
final readonly class PrepareAuditExportsCommand
{
    public function __construct(
        private AuditExports $auditExports,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Tried %d audit log exports.', $this->auditExports->prepareDue()));

        return Command::SUCCESS;
    }
}
