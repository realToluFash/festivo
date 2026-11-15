<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Enum\ErrorCode;
use App\Enum\MeasurementSystem;
use App\Enum\TableShape;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a room, a section, a table, a row and a single seat may be (sc-3998, sc-4000, sc-4003). The clients check the same before sending; this is the one that holds. */
final readonly class SeatingRules
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @return array{roomName: ?string, widthCm: int, lengthCm: int} a blank room name is no name */
    public function room(?string $roomName, ?int $widthCm, ?int $lengthCm, MeasurementSystem $system): array
    {
        $violations = [];
        $name = null === $roomName ? '' : NameNormaliser::name($roomName);

        if (Str\length($name) > SeatingPlan::ROOM_NAME_MAXIMUM) {
            $violations[] = $this->violation('roomName', 'validation.seating_room_name_too_long', ['{count}' => (string) SeatingPlan::ROOM_NAME_MAXIMUM]);
        }

        foreach (['widthCm' => [$widthCm, 'validation.seating_width_required'], 'lengthCm' => [$lengthCm, 'validation.seating_length_required']] as $path => [$side, $missing]) {
            if (null === $side) {
                $violations[] = $this->violation($path, $missing);
            } elseif ($side < SeatingPlan::SIDE_MINIMUM_CM || $side > SeatingPlan::SIDE_MAXIMUM_CM) {
                $violations[] = $this->violation($path, 'validation.seating_room_between', [
                    '{min}' => $system->written(SeatingPlan::SIDE_MINIMUM_CM, $this->translator->getLocale()),
                    '{max}' => $system->written(SeatingPlan::SIDE_MAXIMUM_CM, $this->translator->getLocale()),
                ]);
            }
        }

        if ([] !== $violations || null === $widthCm || null === $lengthCm) {
            throw ApiException::validation($violations);
        }

        return ['roomName' => '' === $name ? null : $name, 'widthCm' => $widthCm, 'lengthCm' => $lengthCm];
    }

    /**
     * @param list<SeatingSection> $others the plan's other sections
     *
     * @return array{name: string, nameKey: string}
     */
    public function sectionName(string $typed, array $others): array
    {
        $name = NameNormaliser::name($typed);
        $key = NameNormaliser::key($name);

        if ('' === $name) {
            throw ApiException::validation([$this->violation('name', 'validation.seating_section_name_required')]);
        }

        if (Str\length($name) > SeatingSection::NAME_MAXIMUM) {
            throw ApiException::validation([$this->violation('name', 'validation.seating_section_name_too_long')]);
        }

        foreach ($others as $other) {
            if ($other->getNameKey() === $key) {
                throw ApiException::validation([$this->violation('name', 'validation.seating_section_name_taken', ['{name}' => $other->getName()])]);
            }
        }

        return ['name' => $name, 'nameKey' => $key];
    }

    /**
     * @param list<SeatingTable> $others the plan's other tables, among which a name is unique without case or accents
     *
     * @return array{name: string, nameKey: string}
     */
    public function tableName(string $typed, array $others): array
    {
        $name = NameNormaliser::name($typed);
        $key = NameNormaliser::key($name);

        if ('' === $name) {
            throw ApiException::validation([$this->violation('name', 'validation.seating_table_name_required')]);
        }

        if (Str\length($name) > SeatingTable::NAME_MAXIMUM) {
            throw ApiException::validation([$this->violation('name', 'validation.seating_table_name_too_long', ['{count}' => (string) SeatingTable::NAME_MAXIMUM])]);
        }

        foreach ($others as $other) {
            if ($other->getNameKey() === $key) {
                throw ApiException::validation([$this->violation('name', 'validation.seating_table_name_taken', ['{name}' => $other->getName()])]);
            }
        }

        return ['name' => $name, 'nameKey' => $key];
    }

    /** @param list<int> $unusableSeats each refusal beside its own field: seats 1 to 30, sizes 40 cm to 10 m, ends 0 to the seats, a long table turned in 15° steps */
    public function tableLayout(TableShape $shape, int $seats, int $widthCm, int $lengthCm, int $endSeats, int $rotation, array $unusableSeats, MeasurementSystem $system): void
    {
        $violations = [];

        if ($seats < SeatingTable::SEATS_MINIMUM || $seats > SeatingTable::SEATS_MAXIMUM) {
            $violations[] = $this->violation('seats', TableShape::Cocktail === $shape ? 'validation.seating_table_places_between' : 'validation.seating_table_seats_between', [
                '{min}' => (string) SeatingTable::SEATS_MINIMUM,
                '{max}' => (string) SeatingTable::SEATS_MAXIMUM,
            ]);
        }

        [$smallest, $largest] = $system->writtenWithin(SeatingTable::SIZE_MINIMUM_CM, SeatingTable::SIZE_MAXIMUM_CM, $this->translator->getLocale());
        $sides = $shape->isRound() ? ['widthCm' => $widthCm] : ['widthCm' => $widthCm, 'lengthCm' => $lengthCm];

        foreach ($sides as $path => $side) {
            if ($side < SeatingTable::SIZE_MINIMUM_CM || $side > SeatingTable::SIZE_MAXIMUM_CM) {
                $violations[] = $this->violation($path, 'validation.seating_table_size_between', ['{min}' => $smallest, '{max}' => $largest]);
            }
        }

        if ($shape->isRound() && 0 !== $endSeats) {
            $violations[] = $this->violation('endSeats', 'validation.seating_table_no_ends');
        } elseif ($endSeats < 0 || $endSeats > $seats) {
            $violations[] = $this->violation('endSeats', 'validation.seating_table_ends_between', ['{max}' => (string) Math\maxva(0, $seats)]);
        }

        if ($shape->isRound() && 0 !== $rotation) {
            $violations[] = $this->violation('rotation', 'validation.seating_table_does_not_turn');
        } elseif ($rotation < 0 || $rotation >= 360 || 0 !== $rotation % SeatingTable::ROTATION_STEP) {
            $violations[] = $this->violation('rotation', 'validation.seating_table_rotation_steps');
        }

        $outOfRange = Vec\filter($unusableSeats, static fn (int $seat): bool => $seat < 1 || $seat > $seats);

        if ([] !== $outOfRange || Iter\count(Vec\unique($unusableSeats)) !== Iter\count($unusableSeats)) {
            $violations[] = $this->violation('unusableSeats', 'validation.seating_table_no_such_seat', ['{max}' => (string) Math\maxva(0, $seats)]);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }
    }

    /**
     * @param list<SeatingRow> $others the plan's other rows, among which a label is unique without case or accents
     *
     * @return array{label: string, labelKey: string}
     */
    public function rowLabel(string $typed, array $others): array
    {
        $label = NameNormaliser::name($typed);
        $key = NameNormaliser::key($label);

        if ('' === $label) {
            throw ApiException::validation([$this->violation('label', 'validation.seating_row_label_required')]);
        }

        if (Str\length($label) > SeatingRow::LABEL_MAXIMUM) {
            throw ApiException::validation([$this->violation('label', 'validation.seating_table_name_too_long', ['{count}' => (string) SeatingRow::LABEL_MAXIMUM])]);
        }

        foreach ($others as $other) {
            if ($other->getLabelKey() === $key) {
                throw ApiException::validation([$this->violation('label', 'validation.seating_row_label_taken', ['{label}' => $other->getLabel()])]);
            }
        }

        return ['label' => $label, 'labelKey' => $key];
    }

    /**
     * @param list<SeatingSeat> $others the plan's other single seats, among which a name is unique without case or accents
     *
     * @return array{name: string, nameKey: string}
     */
    public function seatName(string $typed, array $others): array
    {
        $name = NameNormaliser::name($typed);
        $key = NameNormaliser::key($name);

        if ('' === $name) {
            throw ApiException::validation([$this->violation('name', 'validation.seating_seat_name_required')]);
        }

        if (Str\length($name) > SeatingSeat::NAME_MAXIMUM) {
            throw ApiException::validation([$this->violation('name', 'validation.seating_table_name_too_long', ['{count}' => (string) SeatingSeat::NAME_MAXIMUM])]);
        }

        foreach ($others as $other) {
            if ($other->getNameKey() === $key) {
                throw ApiException::validation([$this->violation('name', 'validation.seating_seat_name_taken', ['{name}' => $other->getName()])]);
            }
        }

        return ['name' => $name, 'nameKey' => $key];
    }

    /** @param list<int> $unusableSeats each refusal beside its own field: seats 1 to 60, spacing 40 cm to 1 m, turned in 15° steps */
    public function rowLayout(int $seats, int $spacingCm, int $rotation, array $unusableSeats, MeasurementSystem $system): void
    {
        $violations = [];

        if ($seats < SeatingRow::SEATS_MINIMUM || $seats > SeatingRow::SEATS_MAXIMUM) {
            $violations[] = $this->violation('seats', 'validation.seating_table_seats_between', [
                '{min}' => (string) SeatingRow::SEATS_MINIMUM,
                '{max}' => (string) SeatingRow::SEATS_MAXIMUM,
            ]);
        }

        if ($spacingCm < SeatingRow::SPACING_MINIMUM_CM || $spacingCm > SeatingRow::SPACING_MAXIMUM_CM) {
            [$smallest, $largest] = $system->writtenWithin(SeatingRow::SPACING_MINIMUM_CM, SeatingRow::SPACING_MAXIMUM_CM, $this->translator->getLocale());
            $violations[] = $this->violation('spacingCm', 'validation.seating_row_spacing_between', ['{min}' => $smallest, '{max}' => $largest]);
        }

        if ($rotation < 0 || $rotation >= 360 || 0 !== $rotation % SeatingTable::ROTATION_STEP) {
            $violations[] = $this->violation('rotation', 'validation.seating_table_rotation_steps');
        }

        $outOfRange = Vec\filter($unusableSeats, static fn (int $seat): bool => $seat < 1 || $seat > $seats);

        if ([] !== $outOfRange || Iter\count(Vec\unique($unusableSeats)) !== Iter\count($unusableSeats)) {
            $violations[] = $this->violation('unusableSeats', 'validation.seating_table_no_such_seat', ['{max}' => (string) Math\maxva(0, $seats)]);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }
    }

    public function unknownSection(): ApiException
    {
        return ApiException::validation([$this->violation('sectionId', 'validation.seating_table_section_unknown')]);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
