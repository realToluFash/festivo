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
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The call-off's or End now's S2 (sc-4333): alone, never with change lines, and the last thing the person is sent. Push only, as every S2 here. */
final readonly class ShiftConcludedNotice implements NotificationTypeInterface, FollowsDeliveryInterface
{
    public const string NAME = 'staff.shift_concluded';

    public const string CALLED_OFF = 'called_off';

    public const string ENDED = 'ended';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private ShiftNoticeWording $shiftNoticeWording,
        private ShiftNoticeReach $shiftNoticeReach,
        private ShiftUrgency $shiftUrgency,
        private StaffRosterPublisher $staffRosterPublisher,
        private TranslatorInterface $translator,
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

    /** It goes once the event is Finished, which is what it tells of. */
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
        $account = $this->entry($payload)?->getAccount();

        return null !== $account && [] !== $this->shiftNoticeReach->of($account->getId());
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $entry = $this->entry($payloads[0]) ?? throw new LogicException('Its person left the roster after it was found still due.');
        $given = Type\shape(['kind' => Type\string(), 'day' => Type\string(), 'startsAt' => Type\vec(Type\string())], true)->coerce($payloads[0]);
        $kind = self::CALLED_OFF === $given['kind'] ? self::CALLED_OFF : self::ENDED;
        $event = $entry->getEvent();
        $body = $this->translator->trans('staff.shift_notice.' . $kind . '_body', [
            'date' => $this->shiftNoticeWording->day($given['day'], $recipient->locale),
        ], 'messages', $recipient->locale);

        return new RenderedNotification(
            $this->translator->trans('staff.shift_notice.' . $kind, ['event' => $event->getName()], 'messages', $recipient->locale),
            $body,
            [$body],
            Str\format('/app/events/%s/my-night', $event->getId()->toRfc4122()),
            notYetUrgent: !$this->shiftUrgency->isUrgent(Vec\map($given['startsAt'], static fn (string $start): DateTimeImmutable => new DateTimeImmutable($start))),
        );
    }

    public function finished(array $payload, NotificationDeliveryStatus $status): void
    {
        $entry = $this->entry($payload);

        if (null !== $entry) {
            $this->staffRosterPublisher->publish($entry->getEvent());
        }
    }

    /** @param array<string, mixed> $payload */
    private function entry(array $payload): ?StaffMember
    {
        $id = Type\shape(['staffMemberId' => Type\string()], true)->coerce($payload)['staffMemberId'];

        return $this->entityManager->find(StaffMember::class, $id);
    }
}
