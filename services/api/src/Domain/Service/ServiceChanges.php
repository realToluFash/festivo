<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\ServicePlate;
use App\Enum\RealtimeTopic;
use App\Enum\SentBackReason;
use App\Realtime\RealtimePublisher;
use App\Repository\MenuCourseRepository;
use Psl\Dict;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Every change to a service, published on its topic as an RFC 6902 patch to each course's read that changed (sc-4005). The patch is made from the read that names nobody, and no step changes a name. */
final readonly class ServiceChanges
{
    public function __construct(
        private ServiceRead $serviceRead,
        private MenuCourseRepository $menuCourseRepository,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    /** @return array<string, array<array-key, mixed>> each course's read, by its id */
    public function reads(Event $event): array
    {
        return Dict\from_entries(Vec\map(
            $this->menuCourseRepository->findOnEvent($event),
            fn (MenuCourse $course): array => [$course->getId()->toRfc4122(), $this->serviceRead->of($course, null)],
        ));
    }

    /** @param array<string, array<array-key, mixed>> $before */
    public function published(Event $event, array $before): void
    {
        foreach ($this->reads($event) as $courseId => $after) {
            $patch = JsonPatch::diff($before[$courseId] ?? null, $after);

            if ([] !== $patch) {
                $this->realtimePublisher->publish(RealtimeTopic::EventService, $event->getId()->toRfc4122(), ['course' => $courseId, 'patch' => $patch]);
            }
        }
    }

    public function alert(ServicePlate $plate, SentBackReason $reason): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventService, $plate->getEvent()->getId()->toRfc4122(), ['alert' => [
            'reason' => $reason->value,
            'plateId' => $plate->getId()->toRfc4122(),
            'courseId' => $plate->getCourse()->getId()->toRfc4122(),
            'guestId' => $plate->getGuest()->getId()->toRfc4122(),
            'table' => $plate->getTableKey(),
            'at' => $this->clock->now()->format(\DATE_RFC3339_EXTENDED),
        ]]);
    }
}
