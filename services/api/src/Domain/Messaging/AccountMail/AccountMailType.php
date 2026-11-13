<?php

declare(strict_types=1);

namespace App\Domain\Messaging\AccountMail;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\AccountMail;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use App\Enum\NotificationDeliveryStatus;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\Exclude;
use Symfony\Component\Uid\Uuid;

/** Written in the person's language when it is queued, so the worker sends the words the request chose (UserMailer::localeFor). */
#[Exclude]
final readonly class AccountMailType implements NotificationTypeInterface
{
    public function __construct(
        private AccountMail $mail,
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    public function name(): string
    {
        return $this->mail->typeName();
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Person;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::AccountSecurity;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Urgent;
    }

    public function channels(): array
    {
        return [NotificationChannel::Email];
    }

    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::Automatic;
    }

    public function canBeSwitchedOff(): bool
    {
        return false;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function carriesCode(): bool
    {
        return $this->mail->carriesCode();
    }

    public function supersedesEarlier(): bool
    {
        return $this->mail->supersedesEarlier();
    }

    public function reachesSuppressed(): bool
    {
        return $this->mail->isSecurity();
    }

    public function collapseKey(): ?string
    {
        return null;
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        $window = $this->mail->onceIn();

        if (null === $window || null === $recipient) {
            return true;
        }

        return false === $this->connection->fetchOne(
            <<<'SQL'
                SELECT 1 FROM notification_deliveries
                WHERE type = :type AND recipient_kind = :kind AND recipient_id = :recipient AND status = :sent AND finished_at >= :since
                LIMIT 1
                SQL,
            [
                'type' => $this->name(),
                'kind' => NotificationAudienceKind::Person->value,
                'recipient' => $recipient->toRfc4122(),
                'sent' => NotificationDeliveryStatus::Sent->value,
                'since' => $this->clock->now()->sub(new DateInterval($window)),
            ],
            ['since' => Types::DATETIME_IMMUTABLE],
        );
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $written = Type\shape(['subject' => Type\string(), 'body' => Type\string()])->coerce($payloads[0]);

        return new RenderedNotification($written['subject'], $written['body']);
    }
}
