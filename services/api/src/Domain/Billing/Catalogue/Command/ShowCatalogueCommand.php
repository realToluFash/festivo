<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Command;

use App\Entity\CatalogueVersion;
use App\Enum\CataloguePart;
use App\Repository\CatalogueVersionRepository;
use App\Repository\SubscriptionRepository;
use DateTimeInterface;
use Psl\Json;
use Psl\Vec;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:catalogue:show',
    description: 'Staff: list every catalogue version, or print one version\'s JSON to start the next from (sc-3928)',
)]
final readonly class ShowCatalogueCommand
{
    public function __construct(
        private CatalogueVersionRepository $catalogueVersionRepository,
        private SubscriptionRepository $subscriptionRepository,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'plans or unit_costs, to print one version')]
        string $part = '',
        #[Argument(description: 'The version\'s name')]
        string $name = '',
    ): int {
        if ('' === $part) {
            $io->table(['Part', 'Name', 'Applies from', 'Published by', 'Subscriptions on it', 'Note'], Vec\map(
                $this->catalogueVersionRepository->findAllInOrder(),
                fn (CatalogueVersion $version): array => [
                    $version->getPart()->value,
                    $version->getName(),
                    $version->getEffectiveFrom()->format(DateTimeInterface::ATOM),
                    $version->getPublishedBy(),
                    CataloguePart::Plans === $version->getPart() ? (string) $this->subscriptionRepository->countOn($version) : '',
                    $version->getNote(),
                ],
            ));

            return Command::SUCCESS;
        }

        $which = CataloguePart::tryFrom($part);
        $version = null === $which ? null : $this->catalogueVersionRepository->findOneByName($which, $name);

        if (null === $version) {
            $io->error('No catalogue version has that part and name.');

            return Command::FAILURE;
        }

        $io->writeln(Json\encode($version->getTerms(), pretty: true));

        return Command::SUCCESS;
    }
}
