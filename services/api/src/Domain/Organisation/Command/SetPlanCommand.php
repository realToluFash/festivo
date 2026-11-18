<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\Plan\PlanChanger;
use App\Entity\Organisation;
use App\Enum\Plan;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Vec;
use RuntimeException;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Uid\Uuid;

#[AsCommand(
    name: 'app:set-plan',
    description: 'Staff: move an organisation to another plan, audited, until billing exists (sc-581)',
)]
final readonly class SetPlanCommand
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private PlanChanger $planChanger,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'The organisation id')]
        string $organisation,
        #[Argument(description: 'free or enterprise')]
        string $plan,
        #[Option(description: 'The member of staff changing it, as the audit trail records them')]
        string $agent = '',
    ): int {
        $to = Plan::tryFrom($plan);

        if (!Uuid::isValid($organisation) || null === $to) {
            $io->error(Str\format('Give an organisation id and one of: %s.', Str\join(Vec\map(Plan::cases(), static fn (Plan $one): string => $one->value), ', ')));

            return Command::INVALID;
        }

        $found = $this->entityManager->find(Organisation::class, Uuid::fromString($organisation));

        if (null === $found) {
            $io->error('No organisation has that id.');

            return Command::FAILURE;
        }

        try {
            $switchedOff = $this->planChanger->change($found, $to, $agent);
        } catch (RuntimeException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(Str\format('%s is on %s.%s', $found->getName(), $to->value, [] === $switchedOff ? '' : ' Its administrators were emailed what was switched off.'));

        return Command::SUCCESS;
    }
}
