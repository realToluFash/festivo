<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Staff\Model\ShiftDetails;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffShift;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\VisibleText;
use App\Repository\StaffJobRepository;
use Psl\Iter;

/** What a job and a shift may be (sc-3908), every problem at once; the web form checks the same before sending. */
final readonly class StaffPlanRules
{
    private const int DAY = 86_400;

    public function __construct(
        private StaffJobRepository $staffJobRepository,
    ) {
    }

    /** The name as it is kept: required, at most 60 characters, and unique on the event ignoring case and accents. */
    public function jobName(Event $event, string $typed, ?StaffJob $editing): string
    {
        $name = NameNormaliser::name($typed);

        if ('' === $name) {
            throw ApiException::validation([$this->violation('name', 'staff.job_name_required')]);
        }

        if (VisibleText::tooLong($name, StaffJob::NAME_MAXIMUM)) {
            throw ApiException::validation([$this->violation('name', 'staff.job_name_too_long', ['{max}' => StaffJob::NAME_MAXIMUM])]);
        }

        $key = NameNormaliser::key($name);
        $same = Iter\search(
            $this->staffJobRepository->findOnEvent($event),
            static fn (StaffJob $job): bool => $job !== $editing && $job->getNameKey() === $key,
        );

        if (null !== $same) {
            throw ApiException::validation([$this->violation('name', 'staff.job_name_taken', ['{name}' => $same->getName()])]);
        }

        return $name;
    }

    /** sc-234's corrections on the times, then 1 to 50 people; `onIt` the people already on the shift being edited. */
    public function shift(Event $event, bool $hasJob, string $startsAt, string $endsAt, int $needed, int $onIt): ShiftDetails
    {
        $violations = [];

        if (!$hasJob) {
            $violations[] = $this->violation('job', 'staff.shift_job_required');
        }

        $start = ShiftClock::wall($startsAt);
        $end = ShiftClock::wall($endsAt);

        if (null === $start) {
            $violations[] = $this->violation('startsAt', 'staff.shift_start_required');
        }

        if (null === $end) {
            $violations[] = $this->violation('endsAt', 'staff.shift_end_required');
        } elseif (null !== $start) {
            $length = ShiftClock::seconds($start, $end, $event);

            if ($length <= 0) {
                $violations[] = $this->violation('endsAt', 'staff.shift_end_before');
            } elseif ($length > self::DAY) {
                $violations[] = $this->violation('endsAt', 'staff.shift_too_long');
            }
        }

        if ($needed < 1 || $needed > StaffShift::NEEDED_MAXIMUM) {
            $violations[] = $this->violation('needed', 'staff.shift_needed_range', ['{max}' => StaffShift::NEEDED_MAXIMUM]);
        } elseif ($needed < $onIt) {
            $violations[] = $this->violation('needed', 'staff.shift_needed_below', ['{n}' => $onIt]);
        }

        if ([] !== $violations || null === $start || null === $end) {
            throw new ApiException(ErrorCode::ValidationFailed, '', $violations, members: ['onShift' => $onIt]);
        }

        return new ShiftDetails($start, $end, $needed);
    }

    /**
     * @param array<string, int|string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string, parameters: array<string, int|string>}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $key,
            'code' => ErrorCode::ValidationFailed->value,
            'parameters' => $parameters,
        ];
    }
}
