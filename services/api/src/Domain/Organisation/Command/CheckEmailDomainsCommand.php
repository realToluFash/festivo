<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\EmailDomains\EmailDomains;
use App\Domain\Organisation\EmailDomains\OnlyOurOrganisation;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every minute: each email domain due a look is looked up, and fails or lapses as of its own instant; each Only our organisation due is recorded as applying. */
#[AsCommand(name: 'app:email-domains:check', description: 'Look up the DNS record of each email domain that is due, fail or lapse each whose time has come, and record each Only our organisation that has started')]
final readonly class CheckEmailDomainsCommand
{
    public function __construct(
        private EmailDomains $emailDomains,
        private OnlyOurOrganisation $onlyOurOrganisation,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Checked %d email domains.', $this->emailDomains->checkDue()));
        $io->writeln(Str\format('Only our organisation started on %d.', $this->onlyOurOrganisation->applyDue()));

        return Command::SUCCESS;
    }
}
