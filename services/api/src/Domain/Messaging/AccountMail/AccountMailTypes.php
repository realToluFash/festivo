<?php

declare(strict_types=1);

namespace App\Domain\Messaging\AccountMail;

use App\Domain\Messaging\Interfaces\NotificationTypeFamilyInterface;
use App\Enum\AccountMail;
use Doctrine\DBAL\Connection;
use Psl\Vec;
use Psr\Clock\ClockInterface;

final readonly class AccountMailTypes implements NotificationTypeFamilyInterface
{
    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function types(): iterable
    {
        return Vec\map(AccountMail::cases(), fn (AccountMail $mail): AccountMailType => new AccountMailType($mail, $this->connection, $this->clock));
    }
}
