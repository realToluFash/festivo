<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Audit\Auditor;
use App\Domain\Staff\Model\StaffDetails;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Http\Exception\ApiException;
use App\Repository\StaffMemberRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The audit holds who and when only: no name or contact detail outlives the erasure. */
final readonly class StaffRoster
{
    public const string ADDED = 'staff.added';

    public const string EDITED = 'staff.edited';

    public const string REMOVED = 'staff.removed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffMemberRepository $staffMemberRepository,
        private RosterMemberMatch $rosterMemberMatch,
        private Auditor $auditor,
        private StaffRosterPublisher $staffRosterPublisher,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** Refused 409 `staff_number_shared`, naming the first entry on that number in roster order, unless `allowShared`. */
    public function add(Event $event, StaffDetails $details, User $by, bool $allowShared): StaffMember
    {
        $entry = $this->entityManager->wrapInTransaction(function () use ($event, $details, $by, $allowShared): StaffMember {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (!$allowShared) {
                $this->refuseShared($event, $details->mobile, null);
            }

            $entry = new StaffMember($event, $details->fullName, $details->mobile, $details->email, $this->rosterMemberMatch->of($event->getOrganisation(), $details));
            $this->entityManager->persist($entry);
            $this->audit(self::ADDED, $entry, $by);
            $this->entityManager->flush();

            return $entry;
        });

        $this->staffRosterPublisher->publish($event);

        return $entry;
    }

    /** Warns as Add does only when the stored number changes; once the contacts are erased only the name is kept. */
    public function edit(StaffMember $entry, StaffDetails $details, User $by, bool $allowShared): StaffMember
    {
        $event = $entry->getEvent();

        $this->entityManager->wrapInTransaction(function () use ($event, $entry, $details, $by, $allowShared): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $erased = null !== $entry->getContactsErasedAt();

            if (!$erased && !$allowShared && $details->mobile !== $entry->getMobile()) {
                $this->refuseShared($event, $details->mobile, $entry);
            }

            $entry->rename($details->fullName);

            if (!$erased) {
                $entry->reach($details->mobile, $details->email, $this->rosterMemberMatch->of($event->getOrganisation(), $details));
            }

            $this->audit(self::EDITED, $entry, $by);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($event);

        return $entry;
    }

    /** Refused 409 `event_concluded` once the event has finished, so its hours keep who worked them. */
    public function remove(StaffMember $entry, User $by): void
    {
        $event = $entry->getEvent();

        $this->entityManager->wrapInTransaction(function () use ($event, $entry, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now())) {
                throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('staff.finished_keeps'));
            }

            $this->audit(self::REMOVED, $entry, $by);
            $this->entityManager->remove($entry);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($event);
    }

    private function refuseShared(Event $event, ?string $mobile, ?StaffMember $besides): void
    {
        $shared = null === $mobile ? null : Iter\search(
            RosterOrder::sort($this->staffMemberRepository->findOnEvent($event)),
            static fn (StaffMember $entry): bool => $entry->getMobile() === $mobile && $entry !== $besides,
        );

        if (null !== $shared) {
            throw new ApiException(
                ErrorCode::StaffNumberShared,
                $this->translator->trans('staff.number_shared', ['{name}' => $shared->getFullName()]),
                members: ['sharedWith' => $shared->getFullName()],
            );
        }
    }

    private function audit(string $action, StaffMember $entry, User $by): void
    {
        $this->auditor->record($action, 'StaffMember', $entry->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
