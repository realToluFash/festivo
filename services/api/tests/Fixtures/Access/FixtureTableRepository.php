<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Access;

use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Symfony\Component\Uid\Uuid;

final class FixtureTableRepository implements EventScopedRepositoryInterface
{
    /** @var list<FixtureTable> */
    public static array $tables = [];

    public function loads(): string
    {
        return FixtureTable::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?object
    {
        foreach (self::$tables as $table) {
            if ($table->id->equals($id) && $table->eventId->equals($eventId)) {
                return $table;
            }
        }

        return null;
    }
}
