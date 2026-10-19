<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\Deletion\OrganisationRestorer;
use Psl\Str;
use RuntimeException;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Uid\Uuid;

#[AsCommand(
    name: 'app:restore-organisation',
    description: 'Support: restore a deleted organisation whole, inside its restore window',
)]
final readonly class RestoreOrganisationCommand
{
    public function __construct(
        private OrganisationRestorer $organisationRestorer,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'The organisation id')]
        string $organisation,
        #[Option(description: 'The support agent restoring it, as the audit trail records them')]
        string $agent = '',
    ): int {
        if (!Uuid::isValid($organisation)) {
            $io->error('That is not an organisation id.');

            return Command::INVALID;
        }

        try {
            $restored = $this->organisationRestorer->restore(Uuid::fromString($organisation), $agent);
        } catch (RuntimeException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(Str\format('Restored %s.', $restored->getName()));

        return Command::SUCCESS;
    }
}
