<?php

declare(strict_types=1);

namespace App\Domain\Staff\WhosHere;

use App\Domain\Organisation\MembershipDirectory;
use App\Domain\Staff\WhosHere\Model\WhosHereView;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\Permission;
use App\Http\Exception\ApiException;
use App\Repository\StaffMemberRepository;
use Psl\Iter;
use Psl\Vec;

/** Who reads Who's here (sc-3918): staff.read and the floor lead see everyone, a station lead their own station's people, and nobody else anything. */
final readonly class WhosHereAccess
{
    public function __construct(
        private MembershipDirectory $membershipDirectory,
        private StaffMemberRepository $staffMemberRepository,
    ) {
    }

    /** Refused 403 `permission_required` on staff.read for anybody else. */
    public function viewOf(User $reader, Event $event): WhosHereView
    {
        $grants = $this->membershipDirectory->grantsOnEvent($reader, $event->getOrganisation()->getId(), $event->getId());
        $manage = $grants?->allows(Permission::StaffManage) ?? false;
        $entries = $this->entriesOf($reader, $event);
        $floorLead = Iter\any($entries, static fn (StaffMember $entry): bool => $entry->isFloorLead());

        if ($floorLead || ($grants?->holds(Permission::StaffRead) ?? false)) {
            return new WhosHereView($reader, null, $manage, $manage || $floorLead);
        }

        $led = Iter\first(Vec\filter_nulls(Vec\map($entries, self::ledBy(...))));

        return null === $led
            ? throw ApiException::permissionRequired(Permission::StaffRead)
            : new WhosHereView($reader, $led, $manage, $manage);
    }

    /** Whether the reader may give this person a number: staff.manage for anyone, and the lead who added a walk-on for that walk-on (pm, 31 Oct). */
    public static function maySetMobile(WhosHereView $view, StaffMember $person): bool
    {
        return null === $person->getContactsErasedAt()
            && ($view->staffManage || true === $person->getWalkOnBy()?->getId()->equals($view->reader->getId()));
    }

    /** Whether the person is one the view shows. */
    public static function shows(WhosHereView $view, StaffMember $person): bool
    {
        return null === $view->station || $person->getStation() === $view->station;
    }

    /** @return list<StaffMember> the reader's own entries on the event, by staff link or by membership */
    private function entriesOf(User $reader, Event $event): array
    {
        return Vec\filter(
            $this->staffMemberRepository->findOnEvent($event),
            static fn (StaffMember $entry): bool => true === $entry->getAccount()?->getId()->equals($reader->getId())
                || true === $entry->getMember()?->getId()->equals($reader->getId()),
        );
    }

    private static function ledBy(StaffMember $entry): ?StaffStation
    {
        $station = $entry->getStation();

        return null !== $station && $station->getLead() === $entry ? $station : null;
    }
}
