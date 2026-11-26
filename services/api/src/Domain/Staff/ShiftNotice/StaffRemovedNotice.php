<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\Event;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Type;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Removed from the event (sc-4333): one last push to somebody taken off the roster after their briefing went, with no link and nothing after it. It still goes once the event is Finished. */
final readonly class StaffRemovedNotice implements NotificationTypeInterface
{
    public const string NAME = 'staff.removed_from_event';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private ShiftNoticeWording $shiftNoticeWording,
        private TranslatorInterface $translator,
    ) {
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Staff;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::EventDay;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Normal;
    }

    public function channels(): array
    {
        return [NotificationChannel::Push];
    }

    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::ChangeNotice;
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
        return false;
    }

    public function supersedesEarlier(): bool
    {
        return false;
    }

    public function reachesSuppressed(): bool
    {
        return false;
    }

    public function collapseKey(array $payload): ?string
    {
        return null;
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null !== $this->event($payload);
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $event = $this->event($payloads[0]) ?? throw new LogicException('Its event went after it was found still due.');
        $day = $event->getStartsAt()->setTimezone(new DateTimeZone($event->getTimeZone()))->format('Y-m-d');

        return new RenderedNotification(
            $this->translator->trans('staff.shift_notice.removed', [
                'event' => $event->getName(),
                'date' => $this->shiftNoticeWording->day($day, $recipient->locale),
            ], 'messages', $recipient->locale),
            '',
        );
    }

    /** @param array<string, mixed> $payload */
    private function event(array $payload): ?Event
    {
        return $this->entityManager->find(Event::class, Type\shape(['eventId' => Type\string()], true)->coerce($payload)['eventId']);
    }
}
