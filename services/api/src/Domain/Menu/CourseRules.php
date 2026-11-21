<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Menu\Model\CourseDetails;
use App\Entity\MenuCourse;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use Psl\Regex;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a course may be (sc-3902), every problem at once; the web form checks the same before sending. */
final readonly class CourseRules
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    public function details(string $name, ?string $servedAt): CourseDetails
    {
        $violations = [];
        $name = NameNormaliser::name($name);
        $time = Str\trim($servedAt ?? '');
        $served = null;

        if ('' === $name) {
            $violations[] = $this->violation('name', 'validation.course_name_required');
        } elseif (VisibleText::tooLong($name, MenuCourse::NAME_MAXIMUM)) {
            $violations[] = $this->violation('name', 'validation.course_name_too_long');
        }

        if ('' !== $time) {
            $found = Regex\first_match($time, '/^([01]?\d|2[0-3]):([0-5]\d)$/');

            if (null === $found) {
                $violations[] = $this->violation('servedAt', 'validation.course_served_invalid');
            } else {
                $served = Str\pad_left($found[1], 2, '0') . ':' . $found[2];
            }
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new CourseDetails($name, $served);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, ['{max}' => (string) MenuCourse::NAME_MAXIMUM]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
