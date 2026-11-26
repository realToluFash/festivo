<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

use App\Audit\Auditor;
use App\Entity\DoorCode;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Http\Exception\ApiException;
use App\Locale\VisibleText;
use App\Repository\DoorCodeRepository;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Making and stopping an event's door codes (sc-72). The route lets only whoever manages its People in. */
final readonly class DoorCodes
{
    /** A clash in 10^12 is retried, not reported. */
    private const int TRIES = 5;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private DoorCodeRepository $doorCodeRepository,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** A code never lives past its event: an end later than the event's is the event's. The code it replaces stops, in the same write. */
    public function make(Event $event, EventRole $role, ?string $jobLabel, ?int $useCap, ?string $expiresAt, User $by, ?DoorCode $replaces = null): DoorCode
    {
        $code = $this->built($event, $role, $jobLabel, $useCap, $expiresAt, $by);

        if (null !== $replaces) {
            $this->stopping($replaces, $by);
            $replaces->setReplacedBy($code);
        }

        $this->entityManager->flush();

        return $code;
    }

    private function built(Event $event, EventRole $role, ?string $jobLabel, ?int $useCap, ?string $expiresAt, User $by): DoorCode
    {
        $violations = [
            ...$this->roleViolations($role),
            ...$this->labelViolations($jobLabel),
            ...$this->capViolations($useCap),
            ...$this->expiryViolations($expiresAt),
        ];

        if ([] !== $violations || null === $useCap || null === $expiresAt) {
            throw ApiException::validation($violations);
        }

        $expires = self::utc(self::instant($expiresAt) ?? $this->clock->now());
        $closes = $event->getClosesAt();

        if (null !== $closes && $expires > $closes) {
            $expires = $closes;
        }

        if ($expires <= $this->clock->now()) {
            throw ApiException::validation([$this->violation('expiresAt', 'door_codes.expiry_past')]);
        }

        $label = Str\trim($jobLabel ?? '');
        $code = new DoorCode($event, $this->unusedCode(), $role, '' === $label ? null : $label, $useCap, $expires, $by);
        $this->entityManager->persist($code);
        $this->record('door_code.made', $code, $by, [
            'role' => [null, $role->value],
            'jobLabel' => [null, $code->getJobLabel()],
            'useCap' => [null, $useCap],
            'expiresAt' => [null, $expires->format(\DATE_ATOM)],
        ]);

        return $code;
    }

    /** Stopping keeps everyone already in; a stopped code stays stopped. */
    public function stop(DoorCode $code, User $by): DoorCode
    {
        $this->stopping($code, $by);
        $this->entityManager->flush();

        return $code;
    }

    private function stopping(DoorCode $code, User $by): void
    {
        if (null === $code->getStoppedAt()) {
            $code->setStoppedAt($this->clock->now());
            $this->record('door_code.stopped', $code, $by, ['stoppedAt' => [null, $this->clock->now()->format(\DATE_ATOM)]]);
        }
    }

    public function statusOf(DoorCode $code, int $used): DoorCodeStatus
    {
        return match (true) {
            null !== $code->getStoppedAt() => DoorCodeStatus::Stopped,
            $code->getExpiresAt() <= $this->clock->now() => DoorCodeStatus::Expired,
            $used >= $code->getUseCap() => DoorCodeStatus::Full,
            default => DoorCodeStatus::Working,
        };
    }

    private function unusedCode(): string
    {
        foreach (Vec\range(1, self::TRIES) as $_) {
            $code = DoorCodeText::generate();

            if (null === $this->doorCodeRepository->findOneByCode($code)) {
                return $code;
            }
        }

        throw new ApiException(ErrorCode::Conflict, 'door_codes.not_made');
    }

    /**
     * A code read out across a room reaches whoever hears it, so it never runs the floor (sc-4002): that is its own 422, before anything else is checked.
     *
     * @return list<array{propertyPath: string, message: string, code: string}>
     */
    private function roleViolations(EventRole $role): array
    {
        if (EventRole::CanRunFloor === $role) {
            throw new ApiException(ErrorCode::LevelNotAllowedForCode, 'door_codes.run_floor');
        }

        return Iter\contains(DoorCode::ROLES, $role) ? [] : [$this->violation('role', 'door_codes.role')];
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> */
    private function labelViolations(?string $jobLabel): array
    {
        return VisibleText::tooLong(Str\trim($jobLabel ?? ''), EventPerson::JOB_LABEL_MAXIMUM)
            ? [$this->violation('jobLabel', 'people.job_label_too_long', ['{count}' => (string) EventPerson::JOB_LABEL_MAXIMUM])]
            : [];
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> */
    private function capViolations(?int $useCap): array
    {
        return match (true) {
            null === $useCap => [$this->violation('useCap', 'door_codes.use_cap_required')],
            $useCap < 1 || $useCap > DoorCode::USE_CAP_MOST => [$this->violation('useCap', 'door_codes.use_cap_range')],
            default => [],
        };
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> */
    private function expiryViolations(?string $expiresAt): array
    {
        $at = null === $expiresAt ? null : self::instant($expiresAt);

        return match (true) {
            null === $at => [$this->violation('expiresAt', 'door_codes.expiry_past')],
            $at <= $this->clock->now() => [$this->violation('expiresAt', 'door_codes.expiry_past')],
            default => [],
        };
    }

    /** An instant with its offset, as the clients send it; anything else is no time at all. */
    private static function instant(string $typed): ?DateTimeImmutable
    {
        $trimmed = Str\trim($typed);

        return DateTimeImmutable::createFromFormat(\DATE_RFC3339_EXTENDED, $trimmed) ?: DateTimeImmutable::createFromFormat(\DATE_ATOM, $trimmed) ?: null;
    }

    private static function utc(DateTimeImmutable $at): DateTimeImmutable
    {
        return $at->setTimezone(new DateTimeZone('UTC'));
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, DoorCode $code, User $by, array $changes): void
    {
        $this->auditor->record($action, 'DoorCode', $code->getId(), Actor::User, $by->getId(), $by->getName(), [
            'eventId' => [null, $code->getEvent()->getId()->toRfc4122()],
            ...$changes,
        ]);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $field, string $key, array $parameters = []): array
    {
        return ['propertyPath' => $field, 'message' => $this->translator->trans($key, $parameters), 'code' => ErrorCode::ValidationFailed->value];
    }
}
