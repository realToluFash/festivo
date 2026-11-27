<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Event\EventVenue;
use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use App\Enum\StaffBriefStatus;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** S3, the reminder the day before (sc-4333): one a person for each day on which a shift of theirs starts, carrying that day's first start. Push only. */
final readonly class ShiftReminderNotice implements NotificationTypeInterface
{
    public const string NAME = 'staff.shift_reminder';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffShiftRepository $staffShiftRepository,
        private ShiftNoticeReach $shiftNoticeReach,
        private ShiftNoticeWording $shiftNoticeWording,
        private TranslatorInterface $translator,
    ) {
    }

    public static function key(StaffMember $entry, string $day): string
    {
        return self::NAME . ':' . $entry->getId()->toRfc4122() . ':' . $day;
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

    /** None goes once the event is Finished (Decided, 27 Oct). */
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

    /** Read again when it goes: the switch on, their briefing gone, a shift of theirs still starting that day, and push reaching them. */
    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        $entry = $this->entry($payload);
        $account = $entry?->getAccount();

        return null !== $entry
            && null !== $account
            && $entry->getEvent()->remindsStaff()
            && StaffBriefStatus::None !== $entry->getBriefStatus()
            && null !== $this->firstOn($entry, self::day($payload))
            && [] !== $this->shiftNoticeReach->of($account->getId());
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $entry = $this->entry($payloads[0]) ?? throw new LogicException('Its person left the roster after it was found still due.');
        $day = self::day($payloads[0]);
        $first = $this->firstOn($entry, $day) ?? throw new LogicException('Its shift went after it was found still due.');
        $event = $entry->getEvent();
        $job = $entry->getJob()?->getName();
        $venue = EventVenue::of($event)?->name;
        $body = null === $job || null === $venue ? '' : $this->translator->trans('staff.shift_reminder.body', ['job' => $job, 'venue' => $venue], 'messages', $recipient->locale);

        return new RenderedNotification(
            $this->translator->trans('staff.shift_reminder.title', [
                'date' => $this->shiftNoticeWording->day($day, $recipient->locale),
                'time' => $this->shiftNoticeWording->time($first->getStartsAt(), $recipient->locale),
                'event' => $event->getName(),
            ], 'messages', $recipient->locale),
            $body,
            '' === $body ? [] : [$body],
            Str\format('/app/events/%s/my-night', $event->getId()->toRfc4122()),
            notYetUrgent: true,
        );
    }

    /** The first of their shifts starting on that day of the event's calendar. */
    private function firstOn(StaffMember $entry, string $day): ?StaffShift
    {
        return Vec\filter($this->staffShiftRepository->findOfPerson($entry), static fn (StaffShift $shift): bool => $shift->getStartsAt()->format('Y-m-d') === $day)[0] ?? null;
    }

    /** @param array<string, mixed> $payload */
    private function entry(array $payload): ?StaffMember
    {
        return $this->entityManager->find(StaffMember::class, Type\shape(['staffMemberId' => Type\string()], true)->coerce($payload)['staffMemberId']);
    }

    /** @param array<string, mixed> $payload */
    private static function day(array $payload): string
    {
        return Type\shape(['day' => Type\string()], true)->coerce($payload)['day'];
    }
}
