<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Audit\Auditor;
use App\Domain\Guest\Model\GuestNeeds;
use App\Entity\Guest;
use App\Entity\GuestNeed;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\NeedKind;
use App\Repository\GuestNeedRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** A guest's and each companion's needs (sc-3777): codes as GuestNeed rows, each Other's words and the note on the Guest. The audit says "Needs changed" and holds none of them. */
final readonly class GuestNeedsRecord
{
    public const string CHANGED = 'guest.needs_changed';

    public function __construct(
        private GuestNeedRepository $guestNeedRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    /**
     * @param list<Guest> $people
     *
     * @return array<string, GuestNeeds> by the person's id; one with none recorded has GuestNeeds::none()
     */
    public function of(array $people): array
    {
        $rows = Dict\group_by($this->guestNeedRepository->findFor($people), static fn (GuestNeed $need): string => $need->getGuest()->getId()->toRfc4122());

        return Dict\from_entries(Vec\map($people, static function (Guest $person) use ($rows): array {
            $theirs = $rows[$person->getId()->toRfc4122()] ?? [];
            $codes = [];
            $others = [];

            foreach (NeedKind::cases() as $kind) {
                $picked = Vec\map(Vec\filter($theirs, static fn (GuestNeed $need): bool => $kind === $need->getKind()), static fn (GuestNeed $need): string => $need->getCode());
                $codes[$kind->value] = Vec\filter($kind->codes(), static fn (string $code): bool => Iter\contains($picked, $code));
                $others[$kind->value] = $person->getOther($kind);
            }

            return [$person->getId()->toRfc4122(), new GuestNeeds($codes, $others, $person->getNeedsNote())];
        }));
    }

    /** Replaces what the person had; nothing is written, and nothing audited, when it is the same. False when nothing changed. */
    public function write(Guest $person, GuestNeeds $needs, User $by): bool
    {
        if ($this->of([$person])[$person->getId()->toRfc4122()]->equals($needs)) {
            return false;
        }

        $this->guestNeedRepository->removeFor($person);

        foreach ($needs->pairs() as [$kind, $code]) {
            $this->entityManager->persist(new GuestNeed($person, $kind, $code));
        }

        foreach (NeedKind::cases() as $kind) {
            $person->setOther($kind, $needs->otherOf($kind));
        }

        $person->setNeedsNote($needs->note);
        $this->auditor->record(self::CHANGED, 'Guest', $person->getId(), Actor::User, $by->getId(), $by->getName());

        return true;
    }
}
