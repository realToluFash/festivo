<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Command;

use App\Domain\Messaging\MailDeliveryRates;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:mail:check-rates', description: 'Log a critical line when 24-hour email bounces exceed 2% or complaints 0.08%')]
final readonly class CheckMailRatesCommand
{
    public function __construct(
        private MailDeliveryRates $mailDeliveryRates,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $rates = $this->mailDeliveryRates->check();

        $io->writeln(Str\format(
            '%d sent, %d bounced, %d complained in 24 hours%s.',
            $rates['sent'],
            $rates['bounced'],
            $rates['complained'],
            [] === $rates['alerts'] ? '' : ': over on ' . Str\join($rates['alerts'], ' and '),
        ));

        return Command::SUCCESS;
    }
}
