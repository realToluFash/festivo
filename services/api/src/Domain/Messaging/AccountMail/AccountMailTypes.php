<?php

declare(strict_types=1);

namespace App\Domain\Messaging\AccountMail;

use App\Domain\Messaging\Interfaces\NotificationTypeFamilyInterface;
use App\Enum\AccountMail;
use Psl\Vec;

final readonly class AccountMailTypes implements NotificationTypeFamilyInterface
{
    public function types(): iterable
    {
        return Vec\map(AccountMail::cases(), static fn (AccountMail $mail): AccountMailType => new AccountMailType($mail));
    }
}
