<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Enum\ErrorCode;
use App\Enum\MeasurementSystem;
use App\Http\Exception\ApiException;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a room and a section may be (sc-3998). The clients check the same before sending; this is the one that holds. */
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
        $name = null === $roomName ? '' : SectionNameNormaliser::name($roomName);

        if (Str\length($name) > SeatingPlan::ROOM_NAME_MAXIMUM) {
            $violations[] = $this->violation('roomName', 'validation.seating_room_name_too_long', ['{count}' => (string) SeatingPlan::ROOM_NAME_MAXIMUM]);
        }

        foreach (['widthCm' => [$widthCm, 'validation.seating_width_required'], 'lengthCm' => [$lengthCm, 'validation.seating_length_required']] as $path => [$side, $missing]) {
            if (null === $side) {
                $violations[] = $this->violation($path, $missing);
            } elseif ($side < SeatingPlan::SIDE_MINIMUM_CM || $side > SeatingPlan::SIDE_MAXIMUM_CM) {
                $violations[] = $this->violation($path, 'validation.seating_room_between', [
                    '{min}' => $system->written(SeatingPlan::SIDE_MINIMUM_CM),
                    '{max}' => $system->written(SeatingPlan::SIDE_MAXIMUM_CM),
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
        $name = SectionNameNormaliser::name($typed);
        $key = SectionNameNormaliser::key($name);

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
