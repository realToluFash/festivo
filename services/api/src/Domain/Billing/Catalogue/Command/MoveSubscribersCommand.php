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
    name: 'app:catalogue:move-subscribers',
    description: 'Staff: move subscriptions onto another plans version, audited (sc-3928). Every one not on it, or only those on --from.',
)]
final readonly class MoveSubscribersCommand
{
    public function __construct(
        private CatalogueKeeper $catalogueKeeper,
        private CatalogueVersionRepository $catalogueVersionRepository,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'The plans version to move them to')]
        string $to,
        #[Option(description: 'Move only the subscriptions on this plans version')]
        string $from = '',
        #[Option(description: 'The member of staff moving them, as the audit trail records them')]
        string $agent = '',
        #[Option(description: 'Why, as the audit trail records it')]
        string $reason = '',
    ): int {
        $target = $this->catalogueVersionRepository->findOneByName(CataloguePart::Plans, $to);
        $source = '' === $from ? null : $this->catalogueVersionRepository->findOneByName(CataloguePart::Plans, $from);

        if (null === $target || ('' !== $from && null === $source)) {
            $io->error('No plans version has that name.');

            return Command::FAILURE;
        }

        try {
            $moved = $this->catalogueKeeper->moveSubscribers($target, $source, $reason, $agent);
        } catch (CatalogueRefused $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(Str\format('%d %s moved to plans %s.', $moved, 1 === $moved ? 'subscription' : 'subscriptions', $target->getName()));

        return Command::SUCCESS;
    }
}
