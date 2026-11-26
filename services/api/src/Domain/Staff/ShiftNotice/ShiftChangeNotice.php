<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Messaging\Interfaces\FollowsDeliveryInterface;
use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Staff\StaffRosterPublisher;
use App\Entity\StaffMember;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** Push only (sc-4333): texts and WhatsApp wait on sc-3946 and sc-3954. */
final readonly class ShiftChangeNotice implements NotificationTypeInterface, FollowsDeliveryInterface
{
    public const string NAME = 'staff.shift_changed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private ToldShifts $toldShifts,
        private ShiftNoticeWording $shiftNoticeWording,
        private StaffRosterPublisher $staffRosterPublisher,
        private ShiftNoticeReach $shiftNoticeReach,
        private ShiftUrgency $shiftUrgency,
    ) {
    }

    public static function key(StaffMember $entry): string
    {
        return self::NAME . ':' . $entry->getId()->toRfc4122();
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

    /** Held while the event is paused; once it is Finished, nothing waiting goes. */
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

    /** Nothing differing from what they were told, an Unassign put back say, cancels it, and so does their not being in the app with notifications allowed by then: the row keeps Changed since sent. */
    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        $entry = $this->entry($payload);
        $account = $entry?->getAccount();

        return null !== $entry && null !== $account && [] !== $this->toldShifts->changesOf($entry) && [] !== $this->shiftNoticeReach->of($account->getId());
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $entry = $this->entry($payloads[0]) ?? throw new LogicException('Its person left the roster after it was found still due.');
        $event = $entry->getEvent();
        $changes = $this->toldShifts->changesOf($entry);
        $lines = $this->shiftNoticeWording->lines($event, $changes, $recipient->locale);

        return new RenderedNotification(
            $this->shiftNoticeWording->title($event, $changes, $recipient->locale),
            Str\join($lines, "\n"),
            $lines,
            Str\format('/app/events/%s/my-night', $event->getId()->toRfc4122()),
            notYetUrgent: !$this->shiftUrgency->isUrgent($this->shiftUrgency->startsOf($entry)),
        );
    }

    /** Once it has gone, what it said is what they were told; one not delivered leaves that as it was, so the roster keeps Changed since sent. */
    public function finished(array $payload, NotificationDeliveryStatus $status): void
    {
        $entry = $this->entry($payload);

        if (null === $entry) {
            return;
        }

        if (NotificationDeliveryStatus::Sent === $status) {
            $this->toldShifts->toldNow($entry);
            $this->entityManager->flush();
        }

        $this->staffRosterPublisher->publish($entry->getEvent());
    }

    /** @param array<string, mixed> $payload */
    private function entry(array $payload): ?StaffMember
    {
        $id = Type\shape(['staffMemberId' => Type\string()], true)->coerce($payload)['staffMemberId'];

        return $this->entityManager->find(StaffMember::class, $id);
    }
}
