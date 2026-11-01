<?php

declare(strict_types=1);

namespace App\Domain\Organisation\OwnerClaims;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\OwnerClaim;
use App\Entity\User;
use App\Repository\OwnerClaimRepository;
use Closure;
use DateTimeImmutable;
use DateTimeInterface;
use Psl\Str;

/** The banner at the top of Members (sc-6640), each instant written in the reader's own zone as sc-868 writes it. */
final readonly class OwnerClaimDescriber
{
    public function __construct(
        private OwnerClaimHandler $ownerClaimHandler,
        private OwnerClaimRepository $ownerClaimRepository,
        private UserMailer $userMailer,
    ) {
    }

    /** A person with no display name is shown by their address, everywhere a name would be. */
    public static function named(?User $user): string
    {
        if (null === $user) {
            return '';
        }

        return '' !== Str\trim($user->getName()) ? $user->getName() : ($user->getPrimaryEmailAddress()?->getAddress() ?? '');
    }

    /** @return array<string, mixed>|null only for an active Administrator while no Owner is active */
    public function forMembers(Organisation $organisation, User $reader): ?array
    {
        if (null === $this->ownerClaimHandler->administratorMembership($reader, $organisation) || !$this->ownerClaimHandler->hasNoActiveOwner($organisation)) {
            return null;
        }

        $written = $this->writer($reader);
        $stop = $this->ownerClaimRepository->findStopIn($organisation);
        $open = $this->ownerClaimRepository->findOpenIn($organisation);
        $last = null === $open && null === $stop ? $this->ownerClaimRepository->findLastBy($reader, $organisation) : null;
        $lapsed = true === $last?->getOutcome()?->lapsed() ? $last->getOutcome() : null;

        return [
            'state' => match (true) {
                null !== $stop => 'closed',
                null === $open => 'no_owner',
                null === $open->getFoundAt() => 'open',
                default => 'found',
            },
            'domain' => $this->ownerClaimHandler->domainFor($organisation, $reader),
            'claim' => null === $open ? null : $this->claim($open, $reader, $written),
            'stopped' => null === $stop ? null : [
                'by' => self::named($stop->getStoppedBy()),
                'claimant' => self::named($stop->getClaimant()),
                'mine' => true === $stop->getStoppedBy()?->getId()->equals($reader->getId()),
                'at' => $written($stop->getEndedAt()),
            ],
            'lapsed' => null === $lapsed ? null : [
                'outcome' => $lapsed->value,
                'at' => $written($last?->getEndedAt()),
            ],
        ];
    }

    /** @return array<string, mixed>|null for a suspended Owner's paused screen, so they can stop it */
    public function forSuspendedOwner(Organisation $organisation, User $reader): ?array
    {
        $open = $this->ownerClaimHandler->isSuspendedOwner($reader, $organisation) ? $this->ownerClaimRepository->findOpenIn($organisation) : null;

        return null === $open ? null : $this->claim($open, $reader, $this->writer($reader));
    }

    /**
     * @param Closure(?DateTimeImmutable): ?array{at: string, written: string} $written
     *
     * @return array<string, mixed>
     */
    private function claim(OwnerClaim $claim, User $reader, Closure $written): array
    {
        $claimant = $claim->getClaimant();
        $mine = $claimant->getId()->equals($reader->getId());

        return [
            'id' => $claim->getId()->toRfc4122(),
            'claimant' => [
                'id' => $claimant->getId()->toRfc4122(),
                'name' => self::named($claimant),
                'email' => $claimant->getPrimaryEmailAddress()?->getAddress(),
            ],
            'mine' => $mine,
            'domain' => $claim->getDomain(),
            'record' => $mine ? ['type' => 'TXT', 'name' => OwnerClaimHandler::recordName($claim->getDomain()), 'value' => $claim->getRecordValue()] : null,
            'startedAt' => $written($claim->getStartedAt()),
            'lapsesAt' => $written($claim->getLapsesAt()),
            'foundAt' => $written($claim->getFoundAt()),
            'passesAt' => $written($claim->getPassesAt()),
        ];
    }

    /** @return Closure(?DateTimeImmutable): ?array{at: string, written: string} */
    private function writer(User $reader): Closure
    {
        $locale = $this->userMailer->shownLocaleFor($reader);

        return fn (?DateTimeImmutable $at): ?array => null === $at ? null : [
            'at' => $at->format(DateTimeInterface::ATOM),
            'written' => $this->userMailer->deadline($at, $reader, $locale),
        ];
    }
}
