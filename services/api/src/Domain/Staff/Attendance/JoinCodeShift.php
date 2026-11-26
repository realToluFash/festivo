<?php

declare(strict_types=1);

namespace App\Domain\Staff\Attendance;

use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\StaffRoster;
use App\Entity\DoorCode;
use App\Entity\PhoneNumber;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Repository\StaffMemberRepository;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A join code that names a shift (sc-234): its redeemer goes on the shift under their account's name if it has room and has not ended, and is clocked in if its window is open. Never clocks anybody out. */
final readonly class JoinCodeShift
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private StaffRoster $staffRoster,
        private Clocking $clocking,
        private ClockInterface $clock,
    ) {
    }

    /** Inside the redemption's transaction; an account already on the roster keeps its entry, and is clocked in only if that entry is on the shift. */
    public function place(StaffShift $shift, User $user, User $issuer): void
    {
        $entry = $this->entryOf($shift, $user);

        if (null === $entry) {
            if (null !== self::notJoinable($shift, $this->clock->now())) {
                return;
            }

            $event = $shift->getJob()->getEvent();
            $entry = $this->staffRoster->add($event, new StaffDetails($user->getName(), self::mobileOf($user), null), $shift->getJob(), $shift, $issuer, true);
            $entry->linkAccount($user);
        } elseif (!Iter\contains($shift->getPeople(), $entry)) {
            return;
        }

        $this->clocking->clockInOn($shift, $entry, $user);
    }

    /**
     * Where a redemption of the code lands, read after it: `night` for an account on the code's shift (My night), `full` or `ended` with the job for You're in's line, null for no line.
     *
     * @return array{landsOn: 'night'}|array{landsOn: 'in', notJoined: 'full'|'ended', job: string}|null
     */
    public function answerFor(DoorCode $doorCode, User $user): ?array
    {
        $shift = $doorCode->getShift();

        if (null === $shift) {
            return null;
        }

        $entry = $this->entryOf($shift, $user);

        if (null !== $entry) {
            return Iter\contains($shift->getPeople(), $entry) ? ['landsOn' => 'night'] : null;
        }

        $why = self::notJoinable($shift, $this->clock->now());

        return null === $why ? null : ['landsOn' => 'in', 'notJoined' => $why, 'job' => $shift->getJob()->getName()];
    }

    /** @return 'full'|'ended'|null */
    private static function notJoinable(StaffShift $shift, DateTimeImmutable $now): ?string
    {
        return match (true) {
            ShiftClock::instant($shift->getEndsAt(), $shift->getJob()->getEvent()) <= $now => 'ended',
            Iter\count($shift->getPeople()) >= $shift->getNeeded() => 'full',
            default => null,
        };
    }

    private function entryOf(StaffShift $shift, User $user): ?StaffMember
    {
        return Iter\first(Vec\filter(
            $this->staffMemberRepository->findOnEvent($shift->getJob()->getEvent()),
            static fn (StaffMember $one): bool => true === $one->getAccount()?->getId()->equals($user->getId()),
        ));
    }

    /** @return ?non-empty-string */
    private static function mobileOf(User $user): ?string
    {
        $number = Iter\first(Vec\filter($user->getPhoneNumbers(), static fn (PhoneNumber $one): bool => null !== $one->getVerifiedAt()))?->getNumber();

        return null === $number || '' === $number ? null : $number;
    }
}
