<?php

declare(strict_types=1);

namespace App\Audit;

use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OwnerClaim;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/**
 * The organisation an entry is about, read when it is recorded, so the log still finds it once its subject is deleted (sc-611).
 * Only the subjects the AC counts as the organisation's are scoped: the organisation, its members, invitations and owner claims, and its events and the people on them.
 */
final readonly class AuditScopes
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function of(string $subjectType, Uuid $subjectId): AuditScope
    {
        return match ($subjectType) {
            'Organisation' => $this->organisation($subjectId),
            'Membership' => $this->membership($subjectId),
            'Invitation' => $this->invitation($subjectId),
            'OwnerClaim' => $this->ownerClaim($subjectId),
            'Event' => $this->event($subjectId),
            'EventPerson' => $this->eventPerson($subjectId),
            default => new AuditScope(),
        };
    }

    private function organisation(Uuid $id): AuditScope
    {
        $organisation = $this->managed(Organisation::class, $id);

        if ($organisation instanceof Organisation) {
            return new AuditScope($id, target: $organisation->getName());
        }

        $row = $this->row('SELECT name FROM organisations WHERE id = :id', $id);

        return new AuditScope($id, target: null === $row ? null : $row['name']);
    }

    private function membership(Uuid $id): AuditScope
    {
        $membership = $this->managed(Membership::class, $id);

        if ($membership instanceof Membership) {
            return new AuditScope($membership->getOrganisation()->getId(), target: $membership->getUser()->getName());
        }

        return $this->scoped('SELECT m.organisation_id, u.name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.id = :id', $id);
    }

    private function invitation(Uuid $id): AuditScope
    {
        $invitation = $this->managed(Invitation::class, $id);

        if ($invitation instanceof Invitation) {
            return new AuditScope($invitation->getOrganisation()?->getId(), target: $invitation->getEmail());
        }

        return $this->scoped('SELECT organisation_id, email AS name FROM invitations WHERE id = :id', $id);
    }

    private function ownerClaim(Uuid $id): AuditScope
    {
        $claim = $this->managed(OwnerClaim::class, $id);

        if ($claim instanceof OwnerClaim) {
            return new AuditScope($claim->getOrganisation()->getId(), target: $claim->getClaimant()->getName());
        }

        return $this->scoped('SELECT c.organisation_id, u.name FROM owner_claims c JOIN users u ON u.id = c.claimant_id WHERE c.id = :id', $id);
    }

    private function event(Uuid $id): AuditScope
    {
        $event = $this->managed(Event::class, $id);

        if ($event instanceof Event) {
            return new AuditScope($event->getOrganisation()->getId(), $id, $event->getName(), $event->getName());
        }

        $row = $this->row('SELECT organisation_id, name FROM events WHERE id = :id', $id);

        return null === $row ? new AuditScope(eventId: $id) : new AuditScope(self::uuid($row['organisation_id']), $id, $row['name'], $row['name']);
    }

    private function eventPerson(Uuid $id): AuditScope
    {
        $person = $this->managed(EventPerson::class, $id);

        if ($person instanceof EventPerson) {
            $event = $person->getEvent();

            return new AuditScope($event->getOrganisation()->getId(), $event->getId(), $event->getName(), $person->getUser()?->getName() ?? $person->getAddress());
        }

        $row = $this->row('SELECT e.organisation_id, e.id AS event_id, e.name AS event_name, COALESCE(u.name, p.address) AS name FROM event_people p JOIN events e ON e.id = p.event_id LEFT JOIN users u ON u.id = p.user_id WHERE p.id = :id', $id);

        return null === $row ? new AuditScope() : new AuditScope(self::uuid($row['organisation_id']), self::uuid($row['event_id']), $row['event_name'], $row['name']);
    }

    /** @param class-string $class */
    private function managed(string $class, Uuid $id): ?object
    {
        $found = $this->entityManager->getUnitOfWork()->tryGetById($id, $class);

        return \is_object($found) ? $found : null;
    }

    private function scoped(string $sql, Uuid $id): AuditScope
    {
        $row = $this->row($sql, $id);

        return null === $row || null === $row['organisation_id'] ? new AuditScope() : new AuditScope(Uuid::fromString($row['organisation_id']), target: $row['name']);
    }

    private static function uuid(?string $id): ?Uuid
    {
        return null === $id ? null : Uuid::fromString($id);
    }

    /** @return ?array<string, ?string> read past the soft-delete filter, for a subject deleted in this same request */
    private function row(string $sql, Uuid $id): ?array
    {
        $row = $this->entityManager->getConnection()->fetchAssociative($sql, ['id' => $id->toRfc4122()]);

        return false === $row ? null : Type\dict(Type\string(), Type\nullable(Type\string()))->coerce($row);
    }
}
