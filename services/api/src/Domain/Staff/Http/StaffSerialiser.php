<?php

declare(strict_types=1);

namespace App\Domain\Staff\Http;

use App\Domain\Staff\RosterOrder;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Repository\StaffMemberRepository;
use Psl\Vec;

/** `link` says only `none`, `no_mobile` or `erased` until sc-3912 sends links; job, station and shift stay null until sc-3908 and sc-3910. */
final readonly class StaffSerialiser
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
    ) {
    }

    /** @return array{staff: list<array<string, mixed>>} */
    public function list(Event $event): array
    {
        return ['staff' => Vec\map(RosterOrder::sort($this->staffMemberRepository->findOnEvent($event)), $this->entry(...))];
    }

    /** @return array<string, mixed> */
    public function entry(StaffMember $entry): array
    {
        return [
            'id' => $entry->getId()->toRfc4122(),
            'fullName' => $entry->getFullName(),
            'mobile' => $entry->getMobile(),
            'email' => $entry->getEmail(),
            'job' => null,
            'station' => null,
            'shift' => null,
            'link' => match (true) {
                null !== $entry->getContactsErasedAt() => 'erased',
                null === $entry->getMobile() => 'no_mobile',
                default => 'none',
            },
            'contactsErased' => null !== $entry->getContactsErasedAt(),
            'version' => $entry->getVersion(),
        ];
    }
}
