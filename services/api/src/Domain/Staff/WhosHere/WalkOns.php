<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere;

use App\Audit\Auditor;
use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\StaffPlan;
use App\Domain\Staff\StaffRoster;
use App\Domain\Staff\StaffRosterPublisher;
use App\Domain\Staff\StaffRules;
use App\Domain\Staff\Station\StationPlan;
use App\Domain\Staff\WhosHere\Model\WhosHereView;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Exception\ApiException;
use App\Repository\StaffJobRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Someone's at the door (sc-3918): a lead puts a person on the roster, on a shift from now and on a station, and gives them their link; and gives a number to someone who has none. The audit names the lead and never the number. */
final readonly class WalkOns
{
    public const string WALKED_ON = 'staff.walked_on';

    public const string MOBILE_ADDED = 'staff.mobile_added';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffRules $staffRules,
        private StaffRoster $staffRoster,
        private StaffPlan $staffPlan,
        private StationPlan $stationPlan,
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
        private StaffRosterPublisher $staffRosterPublisher,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** @param ?array{countryCode: string, number: string} $mobile */
    public function add(Event $event, WhosHereView $view, string $fullName, ?array $mobile, ?string $jobId, ?string $stationId): StaffMember
    {
        if (WhosHereReader::ended($event, $this->clock->now())) {
            throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('whos_here.event_ended'));
        }

        $station = null === $view->station ? $stationId : WhosHereReader::ref($view->station)['id'] ?? null;
        $job = null === $jobId || !Uuid::isValid($jobId) ? null : $this->staffJobRepository->findOneInEvent($event->getId(), Uuid::fromString($jobId));
        $violations = [];

        try {
            $details = $this->staffRules->details($fullName, $mobile, null);
        } catch (ApiException $refused) {
            $details = null;
            $violations = $refused->violations;
        }

        if (null === $job) {
            $violations[] = $this->violation('job', 'whos_here.job_required');
        }

        if (null === $station || '' === Str\trim($station)) {
            $violations[] = $this->violation('station', 'whos_here.station_required');
        }

        if ([] !== $violations || null === $details || null === $job || null === $station) {
            throw ApiException::validation($violations);
        }

        $entry = $this->entityManager->wrapInTransaction(function () use ($event, $view, $details, $job, $station): StaffMember {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $entry = $this->staffRoster->add($event, $details, $job, null, $view->reader, false);
            $entry->setWalkOnBy($view->reader);
            $this->stationPlan->placeWithin($event, $entry, $station, $view->reader);
            $this->staffPlan->assignWithin($this->shift($event, $job), $entry, $view->reader);
            $this->auditor->record(self::WALKED_ON, 'StaffMember', $entry->getId(), Actor::User, $view->reader->getId(), $view->reader->getName());
            $this->entityManager->flush();

            return $entry;
        });

        $this->staffRosterPublisher->publish($event);

        return $entry;
    }

    /** @param array{countryCode: string, number: string} $mobile */
    public function setMobile(WhosHereView $view, StaffMember $person, array $mobile): void
    {
        if (!WhosHereAccess::maySetMobile($view, $person)) {
            throw ApiException::permissionRequired(Permission::StaffManage);
        }

        if ('' === Str\trim($mobile['number'])) {
            throw ApiException::validation([$this->violation('mobile', 'whos_here.mobile_required')]);
        }

        $number = $this->staffRules->details($person->getFullName(), $mobile, null)->mobile;
        $job = $person->getJob();
        $this->staffRoster->edit($person, new StaffDetails($person->getFullName(), $number, $person->getEmail()), $job, $view->reader, false);
        $this->auditor->record(self::MOBILE_ADDED, 'StaffMember', $person->getId(), Actor::User, $view->reader->getId(), $view->reader->getName());
    }

    /** From this minute to the walk-on's end, on the event's clock as every shift is kept, with room for one. */
    private function shift(Event $event, StaffJob $job): StaffShift
    {
        $now = $this->clock->now();
        $end = WhosHereReader::walkOnEnd($job, $this->staffShiftRepository->findOnEvent($event), $event, $now)['end'];
        $shift = new StaffShift($job, self::minute(ShiftClock::wallOf($now, $event)), self::minute(ShiftClock::wallOf($end, $event)), 1);
        $this->entityManager->persist($shift);
        $this->entityManager->flush();

        return $shift;
    }

    private static function minute(DateTimeImmutable $wall): DateTimeImmutable
    {
        return $wall->setTime((int) $wall->format('H'), (int) $wall->format('i'));
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
