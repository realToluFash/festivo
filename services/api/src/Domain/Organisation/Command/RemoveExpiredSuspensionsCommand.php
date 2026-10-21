<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\DomainJoining\DomainSuspender;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every few minutes: the removal is due at one instant, so a daily run would keep somebody up to a day too long. */
#[AsCommand(name: 'app:domain-joining:remove-expired-suspensions', description: 'Remove each domain member whose suspension nobody answered in 30 days')]
final readonly class RemoveExpiredSuspensionsCommand
{
    public function __construct(
        private DomainSuspender $domainSuspender,
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $removed = $this->domainSuspender->removeExpired();
        $this->entityManager->flush();
        $io->writeln(Str\format('Removed %d members whose suspension nobody answered.', $removed));

        return Command::SUCCESS;
    }
}
