<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\User\EmailAddressNormaliser;
use App\Entity\EmailAddress;
use App\Entity\Event;
use App\Entity\PhoneNumber;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Repository\EmailAddressRepository;
use App\Repository\PhoneNumberRepository;
use App\Repository\StaffMemberRepository;
use Closure;
use Psl\Dict;
use Psl\Vec;

/** The name each person goes by at an event (sc-4015): their roster entry's, the first by id when they are on it twice, else their account's. An entry is theirs as VerifiedContactOwner has it, resolved for the whole roster in one query per kind of contact. */
final readonly class RosterNames
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private PhoneNumberRepository $phoneNumberRepository,
        private EmailAddressRepository $emailAddressRepository,
    ) {
    }

    /** @return Closure(User): string */
    public function of(Event $event): Closure
    {
        $roster = $this->staffMemberRepository->findOnEvent($event);
        $mobiles = Vec\filter(Vec\map($roster, static fn (StaffMember $entry): string => $entry->getMobile() ?? ''), static fn (string $one): bool => '' !== $one);
        $emails = Vec\filter(Vec\map($roster, static fn (StaffMember $entry): string => $entry->getEmail() ?? ''), static fn (string $one): bool => '' !== $one);
        $byPhone = Dict\from_entries(Vec\map($this->phoneNumberRepository->findVerifiedAmong($mobiles), static fn (PhoneNumber $one): array => [$one->getNumber(), $one->getUser()]));
        $byEmail = Dict\from_entries(Vec\map($this->emailAddressRepository->findVerifiedAmong($emails), static fn (EmailAddress $one): array => [$one->getAddress(), $one->getUser()]));
        $names = [];

        foreach ($roster as $entry) {
            $owner = $byPhone[$entry->getMobile() ?? ''] ?? $byEmail[EmailAddressNormaliser::normalise($entry->getEmail() ?? '')] ?? null;

            foreach ([$entry->getMember(), $owner] as $user) {
                if (null !== $user) {
                    $names[$user->getId()->toRfc4122()] ??= $entry->getFullName();
                }
            }
        }

        return static fn (User $user): string => $names[$user->getId()->toRfc4122()] ?? $user->getName();
    }
}
