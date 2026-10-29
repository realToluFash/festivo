<?php

declare(strict_types=1);

namespace App\Domain\Event\Command;

use App\Deletion\Restorer;
use App\Entity\Event;
use App\Enum\DeletedKind;
use Psl\Str;
use RuntimeException;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Uid\Uuid;

#[AsCommand(
    name: 'app:restore-event',
    description: 'Support: restore a deleted event whole, as it was when deleted, inside its restore window',
)]
final readonly class RestoreEventCommand
{
    public function __construct(
        private Restorer $restorer,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'The event id')]
        string $event,
        #[Option(description: 'The support agent restoring it, as the audit trail records them')]
        string $agent = '',
    ): int {
        if (!Uuid::isValid($event)) {
            $io->error('That is not an event id.');

            return Command::INVALID;
        }

        try {
            $restored = $this->restorer->restore(DeletedKind::Event, Uuid::fromString($event), $agent);
        } catch (RuntimeException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(Str\format('Restored %s.', $restored instanceof Event ? $restored->getName() : $event));

        return Command::SUCCESS;
    }
}
