<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Domain\Staff\VerifiedContactOwner;
use App\Entity\SeatingSection;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\ServicePlace;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffStationRepository;
use Psl\Iter;

/** Whose table a service write may touch (sc-4002): running the service reaches any table, working it only the tables of a section nobody else is on. */
final readonly class ServiceTables
{
    public function __construct(
        private StaffStationRepository $staffStationRepository,
        private StaffMemberRepository $staffMemberRepository,
        private VerifiedContactOwner $verifiedContactOwner,
    ) {
    }

    /** 403 `permission_required` without the floor, `table_not_yours` for a section with somebody else on it. A table, a row or a block of single seats is reached through its section. */
    public function requireYours(Grants $grants, User $user, ?SeatingSection $section): void
    {
        $grants->requireServiceAt(ServicePlace::Floor);

        if (!$this->reaches($grants, $user, $section)) {
            throw new ApiException(ErrorCode::TableNotYours, 'service.table_not_yours');
        }
    }

    /** Whether a floor write would pass at the section: running the service, or nobody else on it. */
    public function mayWriteAt(Grants $grants, User $user, ?SeatingSection $section): bool
    {
        if ($grants->holds(Permission::ServiceManage)) {
            return true;
        }

        $level = $grants->eventRole();

        if (!$grants->holds(Permission::ServiceWork) || !(null === $level || $level->worksAt(ServicePlace::Floor))) {
            return false;
        }

        return $this->reaches($grants, $user, $section);
    }

    /** @return list<StaffMember> the people on the section's station */
    public function onSection(?SeatingSection $section): array
    {
        $station = null === $section ? null : $this->staffStationRepository->findOneOfSection($section);

        return null === $station ? [] : $this->staffMemberRepository->findOnStation($station);
    }

    public function isOn(?SeatingSection $section, User $user): bool
    {
        return Iter\any($this->onSection($section), fn (StaffMember $entry): bool => $this->isTheirs($entry, $user));
    }

    private function reaches(Grants $grants, User $user, ?SeatingSection $section): bool
    {
        if ($grants->holds(Permission::ServiceManage)) {
            return true;
        }

        $onIt = $this->onSection($section);

        return [] === $onIt || Iter\any($onIt, fn (StaffMember $entry): bool => $this->isTheirs($entry, $user));
    }

    /** The service levels are held from outside the organisation, so the roster's `member` link is no use here: the entry is theirs by a mobile number or email they have verified. */
    public function isTheirs(StaffMember $entry, User $user): bool
    {
        if ($entry->getMember()?->getId()->equals($user->getId()) ?? false) {
            return true;
        }

        return $this->verifiedContactOwner->of($entry->getMobile(), $entry->getEmail())?->getId()->equals($user->getId()) ?? false;
    }
}
