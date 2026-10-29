<?php

declare(strict_types=1);

namespace App\Tests\Double\Messaging;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use DateInterval;
use DateTimeImmutable;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** A registered type that exists only in the suite: no real type has merged yet, and the machine is tested on these. */
final readonly class ScriptedNotificationType implements NotificationTypeInterface
{
    /** @param non-empty-list<NotificationChannel> $channels */
    public function __construct(
        private string $name,
        private NotificationPriority $priority = NotificationPriority::Normal,
        private NotificationEventRule $eventRule = NotificationEventRule::Automatic,
        private ?string $collapseKey = null,
        private ?string $tooLateAfter = null,
        private array $channels = [NotificationChannel::Email],
        private NotificationAudienceKind $audienceKind = NotificationAudienceKind::Member,
        private ?Meanwhile $meanwhile = null,
        private NotificationCategory $category = NotificationCategory::Money,
    ) {
    }

    public function name(): string
    {
        return $this->name;
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return $this->audienceKind;
    }

    public function category(): NotificationCategory
    {
        return $this->category;
    }

    public function priority(): NotificationPriority
    {
        return $this->priority;
    }

    public function channels(): array
    {
        return $this->channels;
    }

    public function eventRule(): NotificationEventRule
    {
        return $this->eventRule;
    }

    public function canBeSwitchedOff(): bool
    {
        return true;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null === $this->tooLateAfter ? null : $dueAt->add(new DateInterval($this->tooLateAfter));
    }

    public function collapseKey(): ?string
    {
        return $this->collapseKey;
    }

    public function isStillDue(array $payload): bool
    {
        $this->meanwhile?->happen();

        return Type\bool()->coerce($payload['stillDue'] ?? true);
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $lines = Vec\map($payloads, static fn (array $payload): string => Type\string()->coerce($payload['line'] ?? ''));

        return new RenderedNotification(
            $this->name,
            Str\join($lines, "\n"),
            Vec\filter($lines, static fn (string $line): bool => '' !== $line),
            Type\nullable(Type\string())->coerce($payloads[0]['place'] ?? null),
        );
    }
}
