<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use DateTimeImmutable;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** One entry of the registry (epic 36, §1). A class implementing this is registered; nothing else can be scheduled. */
#[AutoconfigureTag(self::TAG)]
interface NotificationTypeInterface
{
    public const string TAG = 'app.notification_type';

    /** Stored on every row, so never renamed once it has been sent. */
    public function name(): string;

    public function audienceKind(): NotificationAudienceKind;

    public function category(): NotificationCategory;

    public function priority(): NotificationPriority;

    /** @return non-empty-list<NotificationChannel> */
    public function channels(): array;

    public function eventRule(): NotificationEventRule;

    public function canBeSwitchedOff(): bool;

    /** After this it is recorded Not sent: too late, never sent late. Null when it is never too late. */
    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable;

    /** Due rows sharing a key, for one person on one channel, go out as one message. Null never collapses. */
    public function collapseKey(): ?string;

    /** @param array<string, mixed> $payload asked again at send time; false records the row cancelled */
    public function isStillDue(array $payload): bool;

    /** @param non-empty-list<array<string, mixed>> $payloads one per row collapsed into this message */
    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification;
}
