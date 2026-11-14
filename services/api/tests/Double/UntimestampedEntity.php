<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Doctrine\Traits\Timestampable;

/**
 * The shape TimestampableTest's guard exists to catch: the trait, without the
 * #[ORM\HasLifecycleCallbacks] that makes it do anything.
 *
 * Deliberately not an ORM entity, so Doctrine never maps it and it cannot end
 * up in a schema.
 */
final class UntimestampedEntity
{
    use Timestampable;
}
