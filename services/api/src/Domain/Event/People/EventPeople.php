<?php

declare(strict_types=1);

namespace App\Domain\Event\People;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ContactKind;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Http\Exception\ApiException;
use App\Locale\VisibleText;
use App\Repository\EmailAddressRepository;
use App\Repository\EventPersonRepository;
use App\Repository\MembershipRepository;
use App\Repository\PhoneNumberRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Who has a role on an event, members or from outside (sc-71). The route lets only an Owner, an Admin or the event's Lead in; nobody changes their own. */
final readonly class EventPeople
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private EventPersonRepository $eventPersonRepository,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private OutsideAddress $outsideAddress,
        private EmailAddressRepository $emailAddressRepository,
        private PhoneNumberRepository $phoneNumberRepository,
        private MembershipRepository $membershipRepository,
    ) {
    }

    /** Held at once by an account that has proved the address, otherwise by the address. A member is refused: they reach it through the membership. */
    public function addFromOutside(Event $event, string $typed, EventRole $role, ?string $jobLabel, User $by): EventPerson
    {
        $organisation = $event->getOrganisation();
        [$address, $kind] = $this->outsideAddress->read($typed, $organisation->getCountryCode());
        $this->notLead($role, $organisation->getName());
        $label = $this->jobLabel($jobLabel);
        $account = $this->accountAt($address, $kind);

        if (null !== $account && null !== $this->membershipRepository->findActive($account['user'], $organisation->getId())) {
            throw new ApiException(ErrorCode::AlreadyAMember, $this->translator->trans('members.already_a_member'));
        }

        $holder = null !== $account && $account['verified'] ? $account['user'] : null;
        $already = null === $holder ? $this->eventPersonRepository->findOneByAddress($event->getId(), $address) : $this->eventPersonRepository->findOneOutside($event->getId(), $holder);

        if (null !== $already || (null !== $holder && $holder->getId()->equals($by->getId()))) {
            throw $this->invalid(OutsideAddress::FIELD, 'people.already_on_event');
        }

        $person = null === $holder
            ? EventPerson::pending($event, $address, $kind, $role, $label, $by)
            : EventPerson::outside($event, $holder, $role, $label, $by);
        $this->entityManager->persist($person);
        $this->record('event_person.granted', $person, $by, ['role' => [null, $role->value], 'jobLabel' => [null, $label]]);
        $this->entityManager->flush();

        return $person;
    }

    public function add(Event $event, string $membershipId, EventRole $role, ?string $jobLabel, User $by): EventPerson
    {
        $membership = Uuid::isValid($membershipId) ? $this->entityManager->find(Membership::class, Uuid::fromString($membershipId)) : null;

        if (null === $membership || MembershipStatus::Active !== $membership->getStatus() || !$membership->getOrganisation()->getId()->equals($event->getOrganisation()->getId())) {
            throw $this->invalid('membershipId', 'people.not_a_member');
        }

        $this->notOwnAccount($membership->getUser(), $by);
        $this->notServiceLevel($role);

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
        $this->notOwn($person, $by);
        $changes = [];

        if (null !== $role && $person->isOutside()) {
            $this->notLead($role, $person->getEvent()->getOrganisation()->getName());
        }

        if (null !== $role && !$person->isOutside()) {
            $this->notServiceLevel($role);
        }

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
        $this->notOwn($person, $by);
        $this->record($person->isOutside() ? 'event_person.revoked' : 'event_person.removed', $person, $by, ['role' => [$person->getRole()->value, null]]);
        $this->entityManager->remove($person);
        $this->entityManager->flush();
    }

    private function notOwn(EventPerson $person, User $by): void
    {
        $user = $person->getUser();

        if (null !== $user) {
            $this->notOwnAccount($user, $by);
        }
    }

    private function notOwnAccount(User $user, User $by): void
    {
        if ($user->getId()->equals($by->getId())) {
            throw new ApiException(ErrorCode::OwnEventRole, $this->translator->trans('people.own_role'));
        }
    }

    private function notLead(EventRole $role, string $organisation): void
    {
        if (EventRole::Lead === $role) {
            throw $this->invalid('role', 'people.lead_members_only', ['{organisation}' => $organisation]);
        }
    }

    /** A member holds one of the four event roles (sc-29912); the service levels are for someone working a shift (sc-4002). */
    private function notServiceLevel(EventRole $role): void
    {
        if ($role->isServiceLevel()) {
            throw $this->invalid('role', 'people.service_level_outside_only');
        }
    }

    /** @return array{user: User, verified: bool}|null */
    private function accountAt(string $address, ContactKind $kind): ?array
    {
        $contact = ContactKind::Email === $kind
            ? $this->emailAddressRepository->findOneByAddress($address)
            : $this->phoneNumberRepository->findOneByNumber(Type\non_empty_string()->assert($address));

        return null === $contact ? null : ['user' => $contact->getUser(), 'verified' => $contact->isVerified()];
    }

    private function jobLabel(?string $typed): ?string
    {
        $label = null === $typed ? '' : Str\trim($typed);

        if (VisibleText::tooLong($label, EventPerson::JOB_LABEL_MAXIMUM)) {
            throw $this->invalid('jobLabel', 'people.job_label_too_long', ['{count}' => (string) EventPerson::JOB_LABEL_MAXIMUM]);
        }

        return '' === $label ? null : $label;
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, EventPerson $person, User $by, array $changes): void
    {
        $this->auditor->record($action, 'EventPerson', $person->getId(), Actor::User, $by->getId(), $by->getName(), [
            ...self::whose($person),
            ...$changes,
        ]);
    }

    /** @return array<string, array{0: null, 1: string|null}> an unclaimed address is audited by its kind only */
    public static function whose(EventPerson $person): array
    {
        return [
            'eventId' => [null, $person->getEvent()->getId()->toRfc4122()],
            'membershipId' => [null, $person->getMembership()?->getId()->toRfc4122()],
            'userId' => [null, $person->getUser()?->getId()->toRfc4122()],
            'addressKind' => [null, $person->getAddressKind()?->value],
        ];
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
