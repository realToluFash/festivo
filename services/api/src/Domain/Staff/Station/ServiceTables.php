<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\SeatingTable;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\ServicePlace;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Repository\EmailAddressRepository;
use App\Repository\PhoneNumberRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use Psl\Iter;

/** Whose table a service write may touch (sc-4002): running the service reaches any table, working it only the tables of a section nobody else is on. */
final readonly class ServiceTables
{
    public function __construct(
        private StaffStationRepository $staffStationRepository,
        private StaffMemberRepository $staffMemberRepository,
        private PhoneNumberRepository $phoneNumberRepository,
        private EmailAddressRepository $emailAddressRepository,
    ) {
    }

    /** 403 `permission_required` without the floor, `table_not_yours` for a section with somebody else on it. */
    public function requireYours(Grants $grants, User $user, SeatingTable $table): void
    {
        $grants->requireServiceAt(ServicePlace::Floor);

        if ($grants->holds(Permission::ServiceManage)) {
            return;
        }

        $section = $table->getSection();
        $station = null === $section ? null : $this->staffStationRepository->findOneOfSection($section);
        $onIt = null === $station ? [] : $this->staffMemberRepository->findOnStation($station);

        if ([] !== $onIt && !Iter\any($onIt, fn (StaffMember $entry): bool => $this->isTheirs($entry, $user))) {
            throw new ApiException(ErrorCode::TableNotYours, 'service.table_not_yours');
        }
    }

    /** The service levels are held from outside the organisation, so the roster's `member` link is no use here: the entry is theirs by a mobile number or email they have verified. */
    private function isTheirs(StaffMember $entry, User $user): bool
    {
        if ($entry->getMember()?->getId()->equals($user->getId()) ?? false) {
            return true;
        }

        $mobile = $entry->getMobile();
        $email = $entry->getEmail();
        $byPhone = null === $mobile || '' === $mobile ? null : $this->phoneNumberRepository->findOneByNumber($mobile);
        $byEmail = null === $email || '' === $email ? null : $this->emailAddressRepository->findOneByAddress($email);

        return Iter\any([$byPhone, $byEmail], static fn (PhoneNumber|EmailAddress|null $contact): bool => null !== $contact && $contact->isVerified() && $contact->getUser()->getId()->equals($user->getId()));
    }
}
