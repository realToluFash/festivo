<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Recipient;
use App\Enum\NotificationAudienceKind;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\Uid\Uuid;

/** One per audience kind. Guests' is sc-3957's, on the same rule: resolved at send time. */
#[AutoconfigureTag(self::TAG)]
interface AudienceResolverInterface
{
    public const string TAG = 'app.notification_audience_resolver';

    public function kind(): NotificationAudienceKind;

    /** @return list<Uuid> in ascending order, after the cursor */
    public function resolve(Audience $audience, ?Uuid $after, int $limit): array;

    /** Null once they can no longer be reached: left, removed, deleted. */
    public function recipient(Audience $audience, Uuid $id): ?Recipient;
}
