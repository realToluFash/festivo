<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Entity\Event;
use App\Entity\SeatingSection;
use App\Entity\StaffStation;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use App\Repository\StaffStationRepository;
use Psl\Iter;

/** What a place's name may be (sc-3910): required, at most 60 characters, and unique among the event's places and seating sections, ignoring case and accents. The web checks the same before sending. */
final readonly class StationRules
{
    public function __construct(
        private StaffStationRepository $staffStationRepository,
        private StationSerialiser $stationSerialiser,
    ) {
    }

    public function placeName(Event $event, string $typed, ?StaffStation $editing): string
    {
        $name = NameNormaliser::name($typed);

        if ('' === $name) {
            throw ApiException::validation([self::violation('name', 'stations.name_required')]);
        }

        if (VisibleText::tooLong($name, StaffStation::NAME_MAXIMUM)) {
            throw ApiException::validation([self::violation('name', 'stations.name_too_long', ['{max}' => StaffStation::NAME_MAXIMUM])]);
        }

        $key = NameNormaliser::key($name);
        $section = Iter\search($this->stationSerialiser->sections($event), static fn (SeatingSection $one): bool => NameNormaliser::key($one->getName()) === $key);

        if (null !== $section) {
            throw ApiException::validation([self::violation('name', 'stations.name_taken_section', ['{name}' => $section->getName()])]);
        }

        $place = Iter\search(
            $this->staffStationRepository->findPlaces($event),
            static fn (StaffStation $one): bool => $one !== $editing && $one->getNameKey() === $key,
        );

        if (null !== $place) {
            throw ApiException::validation([self::violation('name', 'stations.name_taken', ['{name}' => $place->getName()])]);
        }

        return $name;
    }

    /**
     * @param array<string, int|string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string, parameters: array<string, int|string>}
     */
    public static function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $key,
            'code' => ErrorCode::ValidationFailed->value,
            'parameters' => $parameters,
        ];
    }
}
