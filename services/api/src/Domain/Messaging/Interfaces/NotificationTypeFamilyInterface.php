<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** Several registered types that differ only by name and a flag or two, as the account emails do. */
#[AutoconfigureTag(self::TAG)]
interface NotificationTypeFamilyInterface
{
    public const string TAG = 'app.notification_type_family';

    /** @return iterable<NotificationTypeInterface> */
    public function types(): iterable;
}
