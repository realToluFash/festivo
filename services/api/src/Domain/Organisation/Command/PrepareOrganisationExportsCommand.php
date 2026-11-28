<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\Export\OrganisationExports;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every minute: an export whose first try, after the response, failed or never finished is tried again, up to its last try. */
#[AsCommand(name: 'app:organisation-exports:prepare', description: 'Try again each organisation export still preparing whose last try has had five minutes')]
final readonly class PrepareOrganisationExportsCommand
{
    public function __construct(
        private OrganisationExports $organisationExports,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Tried %d organisation exports.', $this->organisationExports->prepareDue()));

        return Command::SUCCESS;
    }
}
