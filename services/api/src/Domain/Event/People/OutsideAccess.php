<?php

declare(strict_types=1);

namespace App\Domain\Event\People;

use App\Audit\Auditor;
use App\Domain\User\Interfaces\AddressClaimsInterface;
use App\Entity\EmailAddress;
use App\Entity\EventPerson;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\Actor;
use App\Repository\EventPersonRepository;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** The life of a grant to someone from outside after it is made (sc-71): claimed by an account, and ended with its event. */
final readonly class OutsideAccess implements AddressClaimsInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private EventPersonRepository $eventPersonRepository,
        private MembershipRepository $membershipRepository,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    /** A grant waiting at an address the account has proved becomes the account's, unless it would stack on its membership or role there. */
    public function claimFor(User $user): void
    {
        $addresses = [
            ...Vec\map(Vec\filter($user->getEmailAddresses(), static fn (EmailAddress $email): bool => $email->isVerified()), static fn (EmailAddress $email): string => $email->getAddress()),
            ...Vec\map(Vec\filter($user->getPhoneNumbers(), static fn (PhoneNumber $phone): bool => $phone->isVerified()), static fn (PhoneNumber $phone): string => $phone->getNumber()),
        ];
        $pending = $this->eventPersonRepository->findPendingAt($addresses);

        foreach ($pending as $person) {
            $event = $person->getEvent();
            $stacks = null !== $this->membershipRepository->findActive($user, $event->getOrganisation()->getId())
                || null !== $this->eventPersonRepository->findOneOutside($event->getId(), $user);

            if ($stacks) {
                $this->record('event_person.dropped', $person, $user);
                $this->entityManager->remove($person);

                continue;
            }

            $person->claimBy($user);
            $this->record('event_person.claimed', $person, $user);
        }

        if ([] !== $pending) {
            $this->entityManager->flush();
        }
    }

    /** @return int how many ended */
    public function endConcluded(): int
    {
        $ended = $this->eventPersonRepository->findOutsideConcludedBy($this->clock->now());

        foreach ($ended as $person) {
            $this->auditor->record('event_person.expired', 'EventPerson', $person->getId(), Actor::System, null, null, [
                ...EventPeople::whose($person),
                'role' => [$person->getRole()->value, null],
            ]);
            $this->entityManager->remove($person);
        }

        $this->entityManager->flush();

        return Iter\count($ended);
    }

    private function record(string $action, EventPerson $person, User $by): void
    {
        $this->auditor->record($action, 'EventPerson', $person->getId(), Actor::User, $by->getId(), $by->getName(), EventPeople::whose($person));
    }
}
