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
use DateTimeImmutable;
use Psl\Type;
use Symfony\Component\DependencyInjection\Attribute\Exclude;
use Symfony\Component\Uid\Uuid;

/** Written in the person's language when it is queued, so the worker sends the words the request chose (UserMailer::localeFor). */
#[Exclude]
final readonly class AccountMailType implements NotificationTypeInterface
{
    public function __construct(
        private AccountMail $mail,
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
        return true;
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
