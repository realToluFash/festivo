<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Audit\Auditor;
use App\Domain\Event\EventDay;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\TableSharing;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventDayRefusal;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\TableSharingRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Share tables with guests, Stop sharing, and the day to share them by (sc-4022). Sharing is a switch: nothing is sent, and the plan stays editable. */
final readonly class TableSharer
{
    public const string SHARED = 'seating.tables_shared';

    public const string STOPPED = 'seating.tables_unshared';

    public const string SHARE_BY_CHANGED = 'seating.share_by_changed';

    public function __construct(
        private TableSharingRepository $tableSharingRepository,
        private SeatingSerialiser $seatingSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
        private GuestPageSignal $guestPageSignal,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /**
     * Refused 422 on `shareBy` for a day that is not a date, before today or on or after the event's first day, all in the event's zone (pm, 20 Oct).
     *
     * @param array{shared?: bool, shareBy?: ?string} $fields
     */
    public function change(Event $event, SeatingPlan $plan, array $fields, User $by): void
    {
        $sharing = $this->tableSharingRepository->findOneForPlan($plan) ?? new TableSharing($plan);
        $wasShared = $sharing->isShared();
        $wasBy = $sharing->getShareBy()?->format('Y-m-d');

        if (Iter\contains_key($fields, 'shareBy')) {
            $sharing->setShareBy($this->shareBy($event, $fields['shareBy']));
        }

        if (Iter\contains_key($fields, 'shared')) {
            $fields['shared'] ? $sharing->share($this->clock->now()) : $sharing->stop();
        }

        $this->entityManager->persist($sharing);
        $this->entityManager->flush();

        $nowBy = $sharing->getShareBy()?->format('Y-m-d');

        if ($wasBy !== $nowBy) {
            $this->auditor->record(self::SHARE_BY_CHANGED, 'SeatingPlan', $plan->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(['shareBy' => $wasBy], ['shareBy' => $nowBy]));
        }

        if ($wasShared !== $sharing->isShared()) {
            $this->auditor->record($sharing->isShared() ? self::SHARED : self::STOPPED, 'SeatingPlan', $plan->getId(), Actor::User, $by->getId(), $by->getName(), []);
        }

        $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $event->getId()->toRfc4122(), $this->seatingSerialiser->seating($event, $plan));

        if ($wasShared !== $sharing->isShared()) {
            $this->guestPageSignal->send($event);
        }
    }

    private function shareBy(Event $event, ?string $typed): ?DateTimeImmutable
    {
        if (null === $typed) {
            return null;
        }

        $day = EventDay::before($event, $typed, $this->clock);

        return $day instanceof EventDayRefusal ? throw $this->shareByRefusal('validation.share_by_' . $day->value) : $day;
    }

    private function shareByRefusal(string $key): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => 'shareBy',
            'message' => $this->translator->trans($key),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
