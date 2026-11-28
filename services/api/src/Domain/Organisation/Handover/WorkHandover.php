<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Http\Exception\ApiException;
use App\Repository\EventPersonRepository;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A departing member's events go to whoever takes them, and never to nobody (sc-614). Every handover is audited. Flushing is the caller's; the emails go once it has. */
final readonly class WorkHandover
{
    public const string HANDED_OVER = 'membership.work_handed_over';

    public function __construct(
        private WorkFinder $workFinder,
        private MembershipRepository $membershipRepository,
        private EventPersonRepository $eventPersonRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return list<Event> */
    public function heldBy(Membership $membership): array
    {
        return $this->workFinder->heldBy($membership);
    }

    /** Another active member of the same organisation, named by their membership; anything else, or nobody, is refused on `handTo`. */
    public function recipient(Membership $departing, ?string $handTo): Membership
    {
        $chosen = null !== $handTo && Uuid::isValid($handTo)
            ? $this->membershipRepository->findOneBy(['id' => $handTo, 'organisation' => $departing->getOrganisation()])
            : null;

        if (null === $chosen || MembershipStatus::Active !== $chosen->getStatus() || $chosen->getId()->equals($departing->getId())) {
            throw $this->nobodyChosen();
        }

        return $chosen;
    }

    /** "Choose who takes over their events.", on `handTo`. */
    public function nobodyChosen(): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => 'handTo',
            'message' => $this->translator->trans('handover.choose_recipient'),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }

    /** @return list<Membership> the organisation's active owners other than the one leaving, by name */
    public function otherOwners(Membership $departing): array
    {
        return Vec\sort_by(
            Vec\filter(
                $this->membershipRepository->findOwnersIn($departing->getOrganisation()),
                static fn (Membership $owner): bool => MembershipStatus::Active === $owner->getStatus() && !$owner->getId()->equals($departing->getId()),
            ),
            static fn (Membership $owner): string => $owner->getUser()->getName(),
        );
    }

    /**
     * Each of `$to` becomes Lead of every event, keeping a role and its job label they already have there; the departing member's role on it ends.
     *
     * @param list<Event>      $events
     * @param list<Membership> $to
     */
    public function hand(Membership $departing, array $events, array $to, User $by): void
    {
        foreach ($events as $event) {
            foreach ($to as $taker) {
                $this->makeLead($event, $taker, $by);
            }

            $held = $this->eventPersonRepository->findOneOn($event->getId(), $departing);

            if (null !== $held) {
                $this->record('event_person.removed', 'EventPerson', $held->getId(), $by, [
                    'eventId' => [null, $event->getId()->toRfc4122()],
                    'membershipId' => [$departing->getId()->toRfc4122(), null],
                    'role' => [$held->getRole()->value, null],
                ]);
                $this->entityManager->remove($held);
            }
        }

        $this->record(self::HANDED_OVER, 'Membership', $departing->getId(), $by, [
            'handedTo' => [null, Vec\map($to, static fn (Membership $taker): string => $taker->getId()->toRfc4122())],
            'events' => [null, Vec\map($events, static fn (Event $event): array => ['id' => $event->getId()->toRfc4122(), 'title' => $event->getName()])],
        ]);
    }

    private function makeLead(Event $event, Membership $taker, User $by): void
    {
        $person = $this->eventPersonRepository->findOneOn($event->getId(), $taker);

        if (null === $person) {
            $person = new EventPerson($event, $taker, EventRole::Lead, null);
            $this->entityManager->persist($person);
            $this->record('event_person.added', 'EventPerson', $person->getId(), $by, ['role' => [null, EventRole::Lead->value], 'jobLabel' => [null, null]]);

            return;
        }

        if (EventRole::Lead !== $person->getRole()) {
            $this->record('event_person.changed', 'EventPerson', $person->getId(), $by, ['role' => [$person->getRole()->value, EventRole::Lead->value]]);
            $person->setRole(EventRole::Lead);
        }
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, string $subject, Uuid $id, User $by, array $changes): void
    {
        $this->auditor->record($action, $subject, $id, Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
