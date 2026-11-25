<?php

declare(strict_types=1);

namespace App\Domain\Staff\Station;

use App\Entity\SeatingTable;
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

        if ([] !== $onIt && !Iter\any($onIt, static fn (StaffMember $member): bool => $member->getMember()?->getId()->equals($user->getId()) ?? false)) {
            throw new ApiException(ErrorCode::TableNotYours, 'service.table_not_yours');
        }
    }
}
