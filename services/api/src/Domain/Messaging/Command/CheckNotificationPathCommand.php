<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Command;

use App\Domain\Messaging\Model\PathSymptom;
use App\Domain\Messaging\NotificationPathCheck;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:notifications:check', description: 'Log a critical line when notifications have stopped, are behind, or are failing')]
final readonly class CheckNotificationPathCommand
{
    public function __construct(
        private NotificationPathCheck $notificationPathCheck,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $symptoms = $this->notificationPathCheck->run();

        $io->writeln([] === $symptoms
            ? 'Notifications are going out.'
            : Str\format('Found: %s.', Str\join(Vec\map($symptoms, static fn (PathSymptom $symptom): string => $symptom->value), ', ')));

        return Command::SUCCESS;
    }
}
