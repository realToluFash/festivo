<?php

declare(strict_types=1);

namespace App\Domain\User\Command;

use App\Domain\User\Verification\PhoneCodeDispatch;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every minute: the screen's own read texts a silent WhatsApp code sooner, but only while it is open. */
#[AsCommand(name: 'app:phone-codes:fall-back', description: 'Text the phone codes WhatsApp has not delivered within 30 seconds')]
final readonly class FallBackPhoneCodesCommand
{
    public function __construct(
        private PhoneCodeDispatch $phoneCodeDispatch,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Texted %d phone codes WhatsApp had not delivered.', $this->phoneCodeDispatch->fallBackAllDue()));

        return Command::SUCCESS;
    }
}
