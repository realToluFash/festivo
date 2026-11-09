<?php

declare(strict_types=1);

namespace App\Domain\Seating\Http;

use App\Entity\Event;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Enum\MeasurementSystem;
use App\Repository\SeatingSectionRepository;
use Psl\Iter;
use Psl\Vec;

/** Tables, rows, single seats and seated guests count as none until sc-4000 and sc-4003 can place them (sc-3998). */
final readonly class SeatingSerialiser
{
    public function __construct(
        private SeatingSectionRepository $seatingSectionRepository,
    ) {
    }

    /** @return array<string, mixed> */
    public function seating(Event $event, ?SeatingPlan $plan): array
    {
        return [
            'measurementSystem' => MeasurementSystem::forTerritory($event->getOrganisation()->getCountryCode())->value,
            'plan' => null === $plan ? null : $this->plan($plan),
        ];
    }

    /** @return array<string, mixed> */
    private function plan(SeatingPlan $plan): array
    {
        $sections = $this->seatingSectionRepository->findInPlan($plan);

        return [
            'id' => $plan->getId()->toRfc4122(),
            'roomName' => $plan->getRoomName(),
            'widthCm' => $plan->getWidthCm(),
            'lengthCm' => $plan->getLengthCm(),
            'version' => $plan->getVersion(),
            'changedBy' => $plan->getChangedBy()?->getName(),
            'sections' => Vec\map($sections, self::section(...)),
            'withoutSection' => ['tables' => 0, 'seats' => 0],
            'counts' => [
                'sections' => Iter\count($sections),
                'tables' => 0,
                'rows' => 0,
                'singleSeats' => 0,
                'seatedGuests' => 0,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function section(SeatingSection $section): array
    {
        return [
            'id' => $section->getId()->toRfc4122(),
            'name' => $section->getName(),
            'colour' => $section->getColour()->value,
            'version' => $section->getVersion(),
            'tables' => 0,
            'seats' => 0,
        ];
    }
}
