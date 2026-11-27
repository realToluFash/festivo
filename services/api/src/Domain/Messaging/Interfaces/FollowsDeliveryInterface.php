<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Enum\NotificationDeliveryStatus;

/** A type that keeps its own record of what reached somebody: the worker calls it once each of its deliveries is finished, Sent or not. */
interface FollowsDeliveryInterface
{
    /** @param array<string, mixed> $payload the scheduled row's, as the type was given it */
    public function finished(array $payload, NotificationDeliveryStatus $status): void;
}
