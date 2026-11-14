<?php

declare(strict_types=1);

namespace App\Domain\Event\People;

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
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Who has a role on an event (sc-29912). The route lets only an Owner, an Admin or the event's Lead in; nobody changes their own. */
final readonly class EventPeople
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private EventPersonRepository $eventPersonRepository,
        private Auditor $auditor,
        private TranslatorInterface $translator,
    ) {
    }

    public function add(Event $event, string $membershipId, EventRole $role, ?string $jobLabel, User $by): EventPerson
    {
        $membership = Uuid::isValid($membershipId) ? $this->entityManager->find(Membership::class, Uuid::fromString($membershipId)) : null;

        if (null === $membership || MembershipStatus::Active !== $membership->getStatus() || !$membership->getOrganisation()->getId()->equals($event->getOrganisation()->getId())) {
            throw $this->invalid('membershipId', 'people.not_a_member');
        }

        $this->notOwn($membership, $by);

        if (null !== $this->eventPersonRepository->findOneOn($event->getId(), $membership)) {
            throw $this->invalid('membershipId', 'people.already_on_event');
        }

        $person = new EventPerson($event, $membership, $role, $this->jobLabel($jobLabel));
        $this->entityManager->persist($person);
        $this->record('event_person.added', $person, $by, ['role' => [null, $role->value], 'jobLabel' => [null, $person->getJobLabel()]]);
        $this->entityManager->flush();

        return $person;
    }

    /** A field left out keeps its value. */
    public function change(EventPerson $person, ?EventRole $role, ?string $jobLabel, bool $labelSent, User $by): EventPerson
    {
        $this->notOwn($person->getMembership(), $by);
        $changes = [];

        if (null !== $role && $role !== $person->getRole()) {
            $changes['role'] = [$person->getRole()->value, $role->value];
            $person->setRole($role);
        }

        $label = $this->jobLabel($jobLabel);

        if ($labelSent && $label !== $person->getJobLabel()) {
            $changes['jobLabel'] = [$person->getJobLabel(), $label];
            $person->setJobLabel($label);
        }

        if ([] !== $changes) {
            $this->record('event_person.changed', $person, $by, $changes);
            $this->entityManager->flush();
        }

        return $person;
    }

    public function remove(EventPerson $person, User $by): void
    {
        $this->notOwn($person->getMembership(), $by);
        $this->record('event_person.removed', $person, $by, ['role' => [$person->getRole()->value, null]]);
        $this->entityManager->remove($person);
        $this->entityManager->flush();
    }

    private function notOwn(Membership $membership, User $by): void
    {
        if ($membership->getUser()->getId()->equals($by->getId())) {
            throw new ApiException(ErrorCode::OwnEventRole, $this->translator->trans('people.own_role'));
        }
    }

    private function jobLabel(?string $typed): ?string
    {
        $label = null === $typed ? '' : Str\trim($typed);

        if (Str\length($label) > EventPerson::JOB_LABEL_MAXIMUM) {
            throw $this->invalid('jobLabel', 'people.job_label_too_long', ['{count}' => (string) EventPerson::JOB_LABEL_MAXIMUM]);
        }

        return '' === $label ? null : $label;
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, EventPerson $person, User $by, array $changes): void
    {
        $this->auditor->record($action, 'EventPerson', $person->getId(), Actor::User, $by->getId(), $by->getName(), [
            'eventId' => [null, $person->getEvent()->getId()->toRfc4122()],
            'membershipId' => [null, $person->getMembership()->getId()->toRfc4122()],
            ...$changes,
        ]);
    }

    /** @param array<string, string> $parameters */
    private function invalid(string $field, string $key, array $parameters = []): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => $field,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
