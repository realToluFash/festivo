<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Domain\Messaging\Model\PushTarget;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\PushTargetKind;
use RuntimeException;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** One provider behind push. Its call ends within the worker's limit; none takes an idempotency key, so the collapse key goes as its own. */
#[AutoconfigureTag(self::TAG)]
interface PushServiceInterface
{
    public const string TAG = 'app.push_service';

    public function kind(): PushTargetKind;

    /**
     * @return ?string the provider's id for the message, or null when the device no longer takes push
     *
     * @throws RuntimeException when the provider refused it, with a reason that quotes no address
     */
    public function push(PushTarget $target, NotificationCategory $category, RenderedNotification $notification, ?string $collapseKey): ?string;
}
