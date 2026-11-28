<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Command;

use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Billing\Catalogue\Exception\CatalogueRefused;
use App\Enum\CataloguePart;
use DateTimeInterface;
use Psl\File;
use Psl\File\Exception\ExceptionInterface as FileException;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use RuntimeException;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:catalogue:publish',
    description: 'Staff: publish a new version of the plans or the unit costs from a JSON file, audited (sc-3928). `app:catalogue:show` prints one to start from.',
)]
final readonly class PublishCatalogueCommand
{
    public function __construct(
        private CatalogueKeeper $catalogueKeeper,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'plans or unit_costs')]
        string $part,
        #[Argument(description: 'The new version\'s name, such as 2026-12-01')]
        string $name,
        #[Argument(description: 'The JSON file holding the whole version')]
        string $file,
        #[Option(description: 'The member of staff publishing it, as the audit trail records them')]
        string $agent = '',
        #[Option(description: 'What changed and why, as the audit trail records it')]
        string $note = '',
    ): int {
        $which = CataloguePart::tryFrom($part);

        if (null === $which || '' === $file) {
            $io->error('Give plans or unit_costs, a name and a JSON file.');

            return Command::INVALID;
        }

        try {
            $terms = Json\typed(File\read($file), Type\dict(Type\string(), Type\mixed()));
            $version = $this->catalogueKeeper->publish($which, $name, $terms, $note, $agent);
        } catch (CatalogueRefused|FileException|RuntimeException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(Str\format('%s %s is published and applies from %s.', $which->value, $version->getName(), $version->getEffectiveFrom()->format(DateTimeInterface::ATOM)));

        return Command::SUCCESS;
    }
}
