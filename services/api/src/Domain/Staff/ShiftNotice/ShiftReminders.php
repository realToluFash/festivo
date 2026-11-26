<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Audit\Auditor;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\StaffRosterPublisher;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\ScheduledNotificationStatus;
use App\Enum\StaffBriefStatus;
use App\Http\Exception\ApiException;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** S3, the reminder the day before (sc-4333): planned for each person whenever their shifts, their briefing or the switch change, and the staffing page's card. */
final readonly class ShiftReminders
{
    public const string SWITCHED = 'staff.reminder_switched';

    private const string AT = '10:00';

    public function __construct(
        private NotificationScheduler $notificationScheduler,
        private StaffShiftRepository $staffShiftRepository,
        private StaffMemberRepository $staffMemberRepository,
        private ShiftNoticeReach $shiftNoticeReach,
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private StaffRosterPublisher $staffRosterPublisher,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** One already due is left for the worker, which reads it again. One held, through a pause say, lapses at the day's first start rather than going after it. */
    public function plan(StaffMember ...$entries): void
    {
        $now = $this->clock->now();

        foreach ($entries as $entry) {
            $event = $entry->getEvent();
            $wanted = [];
            $firstStart = [];

            if ($event->remindsStaff() && StaffBriefStatus::None !== $entry->getBriefStatus() && EventPhase::Finished !== self::phase($event, $now)) {
                foreach ($this->staffShiftRepository->findOfPerson($entry) as $shift) {
                    $day = $shift->getStartsAt()->format('Y-m-d');
                    $key = ShiftReminderNotice::key($entry, $day);
                    $wanted[$key] = $day;
                    $firstStart[$key] = isset($firstStart[$key]) && $firstStart[$key] < $shift->getStartsAt() ? $firstStart[$key] : $shift->getStartsAt();
                }
            }

            foreach ($this->waiting($entry) as $key) {
                if (!isset($wanted[$key])) {
                    $this->notificationScheduler->cancel($key);
                }
            }

            foreach ($wanted as $key => $day) {
                if (self::trigger($day)->dueAt(EventTimes::of($event)) <= $now) {
                    continue;
                }

                $this->notificationScheduler->schedule(
                    ShiftReminderNotice::NAME,
                    $key,
                    $entry->getId()->toRfc4122() . ':' . $day,
                    self::trigger($day),
                    Audience::staffMember($event->getId(), $entry->getId()),
                    ['staffMemberId' => $entry->getId()->toRfc4122(), 'day' => $day],
                    $event,
                    ShiftClock::instant($firstStart[$key], $event),
                );
            }
        }
    }

    public function forget(StaffMember $entry): void
    {
        foreach ($this->waiting($entry) as $key) {
            $this->notificationScheduler->cancel($key);
        }
    }

    /** Refused 409 `event_concluded` once the event is Finished, when the card has no switch. */
    public function switch(Event $event, bool $on, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $on, $by): void {
            if (EventPhase::Finished === self::phase($event, $this->clock->now())) {
                throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('staff.reminder_concluded'));
            }

            if ($event->remindsStaff() === $on) {
                return;
            }

            $event->setStaffReminder($on);
            $this->auditor->record(self::SWITCHED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), ['staffReminder' => [!$on, $on]]);
            $this->entityManager->flush();
            $this->plan(...$this->staffMemberRepository->findOnEvent($event));
        });

        $this->staffRosterPublisher->publish($event);
    }

    /** @return array<string, mixed> `next` and `sent` dated the day the reminder goes */
    public function card(Event $event): array
    {
        $now = $this->clock->now();
        $phase = self::phase($event, $now);
        $times = EventTimes::of($event);
        $shifts = Vec\filter($this->staffShiftRepository->findOnEvent($event), static fn (StaffShift $shift): bool => [] !== $shift->getPeople());
        $days = Vec\sort(Vec\unique(Vec\map($shifts, static fn (StaffShift $shift): string => $shift->getStartsAt()->format('Y-m-d'))));
        $last = Iter\last($days);
        $sent = null;

        if (null !== $last && self::trigger($last)->dueAt($times) <= $now) {
            $count = $this->sentOn($event, $last);
            $sent = 0 === $count ? null : ['date' => self::dayBefore($last), 'count' => $count];
        }

        $reach = $this->reach(...self::people(...$shifts));
        $next = null;

        foreach ($days as $day) {
            if (self::trigger($day)->dueAt($times) <= $now) {
                continue;
            }

            $count = Iter\count(Vec\filter(
                self::people(...Vec\filter($shifts, static fn (StaffShift $shift): bool => $shift->getStartsAt()->format('Y-m-d') === $day)),
                static fn (StaffMember $one): bool => StaffBriefStatus::None !== $one->getBriefStatus() && isset($reach[$one->getId()->toRfc4122()]),
            ));

            if ($count > 0) {
                $next = ['date' => self::dayBefore($day), 'count' => $count];

                break;
            }
        }

        $ahead = self::people(...Vec\filter($shifts, static fn (StaffShift $shift): bool => ShiftClock::instant($shift->getStartsAt(), $event) > $now));
        $briefed = Vec\filter($ahead, static fn (StaffMember $one): bool => StaffBriefStatus::None !== $one->getBriefStatus());

        return [
            'on' => $event->remindsStaff(),
            'time' => self::AT,
            'next' => $next,
            'notBriefed' => Iter\count($ahead) - Iter\count($briefed),
            'unreachable' => Iter\count(Vec\filter($briefed, static fn (StaffMember $one): bool => !isset($reach[$one->getId()->toRfc4122()]))),
            'sent' => $sent,
            'concluded' => match (true) {
                EventPhase::Finished !== $phase => null,
                EventPhase::calledOff($event->getEndedAt(), $event->getStartsAt()) => ShiftConcludedNotice::CALLED_OFF,
                default => ShiftConcludedNotice::ENDED,
            },
        ];
    }

    /** @return array<string, true> by the person's id, those push reaches */
    private function reach(StaffMember ...$people): array
    {
        $accounts = Vec\filter_nulls(Vec\map($people, static fn (StaffMember $one): ?Uuid => $one->getAccount()?->getId()));
        $reached = $this->shiftNoticeReach->of(...$accounts);
        $found = [];

        foreach ($people as $one) {
            $account = $one->getAccount();

            if (null !== $account && isset($reached[$account->getId()->toRfc4122()])) {
                $found[$one->getId()->toRfc4122()] = true;
            }
        }

        return $found;
    }

    private function sentOn(Event $event, string $day): int
    {
        return Type\int()->coerce($this->connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(DISTINCT d.recipient_id)
                FROM notification_deliveries d
                JOIN scheduled_notifications n ON n.id = d.scheduled_notification_id
                WHERE n.type = :type AND n.event_id = :event AND d.status = :sent AND n.payload->>'day' = :day
                SQL,
            ['type' => ShiftReminderNotice::NAME, 'event' => $event->getId()->toRfc4122(), 'sent' => NotificationDeliveryStatus::Sent->value, 'day' => $day],
        ));
    }

    /** @return list<string> the cancellation keys of the person's reminders still to go */
    private function waiting(StaffMember $entry): array
    {
        return Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            "SELECT cancellation_key FROM scheduled_notifications WHERE type = :type AND split_part(source_id, ':', 1) = :person AND status = :pending",
            ['type' => ShiftReminderNotice::NAME, 'person' => $entry->getId()->toRfc4122(), 'pending' => ScheduledNotificationStatus::Pending->value],
        ));
    }

    /** @return list<StaffMember> each once */
    private static function people(StaffShift ...$shifts): array
    {
        return Vec\values(Dict\unique_by(Vec\flat_map($shifts, static fn (StaffShift $shift): array => $shift->getPeople()), static fn (StaffMember $one): string => $one->getId()->toRfc4122()));
    }

    private static function trigger(string $day): Trigger
    {
        return Trigger::relativeTo($day, '-P1D', self::AT);
    }

    private static function dayBefore(string $day): string
    {
        return new DateTimeImmutable($day)->modify('-1 day')->format('Y-m-d');
    }

    private static function phase(Event $event, DateTimeImmutable $now): EventPhase
    {
        return EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
    }
}
