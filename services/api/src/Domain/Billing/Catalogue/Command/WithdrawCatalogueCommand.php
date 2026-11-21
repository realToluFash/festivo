<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Command;

use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Billing\Catalogue\Exception\CatalogueRefused;
use App\Enum\CataloguePart;
use App\Repository\CatalogueVersionRepository;
use Psl\Str;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:catalogue:withdraw',
    description: 'Staff: take back a catalogue version nothing uses yet, audited (sc-3928). A version in use is never edited or deleted.',
)]
final readonly class WithdrawCatalogueCommand
{
    public function __construct(
        private CatalogueKeeper $catalogueKeeper,
        private CatalogueVersionRepository $catalogueVersionRepository,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'plans or unit_costs')]
        string $part,
        #[Argument(description: 'The version\'s name')]
        string $name,
        #[Option(description: 'The member of staff withdrawing it, as the audit trail records them')]
        string $agent = '',
        #[Option(description: 'Why, as the audit trail records it')]
        string $reason = '',
    ): int {
        $which = CataloguePart::tryFrom($part);
        $version = null === $which ? null : $this->catalogueVersionRepository->findOneByName($which, $name);

        if (null === $version) {
            $io->error('No catalogue version has that part and name.');

            return Command::FAILURE;
        }

        try {
            $this->catalogueKeeper->withdraw($version, $reason, $agent);
        } catch (CatalogueRefused $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(Str\format('%s %s is withdrawn.', $part, $name));

        return Command::SUCCESS;
    }
}
