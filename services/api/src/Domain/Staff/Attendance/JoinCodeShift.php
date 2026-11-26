<?php

declare(strict_types=1);

namespace App\Domain\Staff\Attendance;

use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\StaffRoster;
use App\Entity\PhoneNumber;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Repository\StaffMemberRepository;
use Psl\Iter;
use Psl\Vec;

/** A join code that names a shift (sc-234): its redeemer goes on the shift under their account's name if it has room, and is clocked in if its window is open. Never clocks anybody out. */
final readonly class JoinCodeShift
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private StaffRoster $staffRoster,
        private Clocking $clocking,
    ) {
    }

    /** Inside the redemption's transaction; an account already on the roster keeps its entry, and is clocked in only if that entry is on the shift. */
    public function place(StaffShift $shift, User $user, User $issuer): void
    {
        $event = $shift->getJob()->getEvent();
        $entry = Iter\first(Vec\filter(
            $this->staffMemberRepository->findOnEvent($event),
            static fn (StaffMember $one): bool => true === $one->getAccount()?->getId()->equals($user->getId()),
        ));

        if (null === $entry) {
            if (Iter\count($shift->getPeople()) >= $shift->getNeeded()) {
                return;
            }

            $entry = $this->staffRoster->add($event, new StaffDetails($user->getName(), self::mobileOf($user), null), $shift->getJob(), $shift, $issuer, true);
            $entry->linkAccount($user);
        } elseif (!Iter\contains($shift->getPeople(), $entry)) {
            return;
        }

        $this->clocking->clockInOn($shift, $entry, $user);
    }

    /** @return ?non-empty-string */
    private static function mobileOf(User $user): ?string
    {
        $number = Iter\first(Vec\filter($user->getPhoneNumbers(), static fn (PhoneNumber $one): bool => null !== $one->getVerifiedAt()))?->getNumber();

        return null === $number || '' === $number ? null : $number;
    }
}
