<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Repository\TableSharingRepository;

/** A bare signal with no guest's data that tells every open guest page of the event to ask again (sc-4022); a refusing hub never fails the change. */
final readonly class GuestPageSignal
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private TableSharingRepository $tableSharingRepository,
    ) {
    }

    public function send(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventGuestPages, $event->getId()->toRfc4122(), []);
    }

    /** After the plan or who sits where changed: only shared tables show on a guest's page, so nothing else is worth an ask. */
    public function seatingChanged(Event $event): void
    {
        if ($this->tableSharingRepository->findOneForEvent($event)?->isShared() ?? false) {
            $this->send($event);
        }
    }
}
