<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Deletion\Interfaces\PurgedRowRemoverInterface;
use Doctrine\DBAL\Connection;

/** A billing account goes with the last organisation it paid for, and its contact's address with it (sc-3927). */
final readonly class UnpaidForAccountRemover implements PurgedRowRemoverInterface
{
    public function __construct(
        private Connection $connection,
    ) {
    }

    public function remove(): void
    {
        $this->connection->executeStatement(<<<'SQL'
            DELETE FROM billing_accounts a
            WHERE  NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.billing_account_id = a.id)
            SQL);
    }
}
