<?php

declare(strict_types=1);

namespace App\Http\Access\Interfaces;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\Uid\Uuid;

/** How an event's sub-resource is loaded: by its id within that event, never by its id alone. */
#[AutoconfigureTag(self::TAG)]
interface EventScopedRepositoryInterface
{
    public const string TAG = 'app.event_scoped_repository';

    /** @return class-string */
    public function loads(): string;

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?object;
}
