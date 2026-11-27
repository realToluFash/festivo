<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\NotificationAudienceKind;
use App\Enum\Permission;
use DateTimeImmutable;
use DateTimeInterface;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Who a notification is for, as a rule rather than a list: it is resolved when it is sent, so somebody who joined or left since counts as they are then. */
final readonly class Audience
{
    /**
     * @param list<Uuid>           $only       when not empty, nobody outside it
     * @param list<Uuid>           $except     the one who acted, say
     * @param array<string, mixed> $conditions a guest audience's, for sc-3957's resolver
     * @param ?DateTimeImmutable   $joinedBy   when set, only members who had joined by then
     */
    private function __construct(
        public NotificationAudienceKind $kind,
        public ?Uuid $organisationId,
        public ?Permission $permission = null,
        public ?Uuid $roleId = null,
        public array $only = [],
        public array $except = [],
        public array $conditions = [],
        public ?Uuid $eventId = null,
        public ?DateTimeImmutable $joinedBy = null,
    ) {
    }

    /**
     * Owners and Admins holding it, and Members whose role on the event holds it (sc-29912).
     *
     * @param list<Uuid> $except
     */
    public static function membersOfEvent(Uuid $organisationId, Uuid $eventId, Permission $permission, array $except = []): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, permission: $permission, except: $except, eventId: $eventId);
    }

    /** One member, while they still reach the event with the permission when it goes. */
    public static function memberOfEvent(Uuid $organisationId, Uuid $eventId, Permission $permission, Uuid $userId): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, permission: $permission, only: [$userId], eventId: $eventId);
    }

    /**
     * Those named, each while they still reach the event with the permission when it goes.
     *
     * @param non-empty-list<Uuid> $userIds
     */
    public static function namedMembersOfEvent(Uuid $organisationId, Uuid $eventId, Permission $permission, array $userIds): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, permission: $permission, only: $userIds, eventId: $eventId);
    }

    /** @param list<Uuid> $except */
    public static function membersWithPermission(Uuid $organisationId, Permission $permission, array $except = []): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, permission: $permission, except: $except);
    }

    /** One member, while they still hold the permission when it goes. */
    public static function memberWithPermission(Uuid $organisationId, Permission $permission, Uuid $userId): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, permission: $permission, only: [$userId]);
    }

    /** @param list<Uuid> $except */
    public static function membersWithRole(Uuid $organisationId, Uuid $roleId, array $except = []): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, roleId: $roleId, except: $except);
    }

    /** @param non-empty-list<Uuid> $userIds still only while each is an active member */
    public static function members(Uuid $organisationId, array $userIds): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, only: $userIds);
    }

    /** Every member who had joined by the moment, still only while each is an active member: somebody who joins later joined under what that moment changed (sc-18317). */
    public static function membersJoinedBy(Uuid $organisationId, DateTimeImmutable $at): self
    {
        return new self(NotificationAudienceKind::Member, $organisationId, joinedBy: $at);
    }

    /** One person at the address they are written to now, whatever becomes of their account or organisation (sc-4332). */
    public static function person(Uuid $id, string $address, string $locale): self
    {
        return new self(NotificationAudienceKind::Person, null, only: [$id], conditions: ['address' => $address, 'locale' => $locale]);
    }

    /** One person on an event's staff, through the account they sign in to the app with, while they are still on its roster when it goes (sc-4333). */
    public static function staffMember(Uuid $eventId, Uuid $staffMemberId): self
    {
        return new self(NotificationAudienceKind::Staff, null, only: [$staffMemberId], eventId: $eventId);
    }

    /** Somebody taken off an event's staff, through their account, since there is no roster entry left to find them by (sc-4333). */
    public static function removedStaffMember(Uuid $eventId, Uuid $accountId): self
    {
        return new self(NotificationAudienceKind::Staff, null, conditions: ['account' => $accountId->toRfc4122()], eventId: $eventId);
    }

    /** @param array<string, mixed> $conditions */
    public static function guests(Uuid $eventId, array $conditions): self
    {
        return new self(NotificationAudienceKind::Guest, null, conditions: ['eventId' => $eventId->toRfc4122(), ...$conditions]);
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'kind' => $this->kind->value,
            'organisationId' => $this->organisationId?->toRfc4122(),
            'permission' => $this->permission?->value,
            'roleId' => $this->roleId?->toRfc4122(),
            'only' => Vec\map($this->only, static fn (Uuid $id): string => $id->toRfc4122()),
            'except' => Vec\map($this->except, static fn (Uuid $id): string => $id->toRfc4122()),
            'conditions' => $this->conditions,
            'eventId' => $this->eventId?->toRfc4122(),
            'joinedBy' => $this->joinedBy?->format(DateTimeInterface::ATOM),
        ];
    }

    /** @param array<array-key, mixed> $stored */
    public static function fromArray(array $stored): self
    {
        $shape = Type\shape([
            'kind' => Type\backed_enum(NotificationAudienceKind::class),
            'organisationId' => Type\nullable(Type\string()),
            'permission' => Type\nullable(Type\backed_enum(Permission::class)),
            'roleId' => Type\nullable(Type\string()),
            'only' => Type\vec(Type\string()),
            'except' => Type\vec(Type\string()),
            'conditions' => Type\dict(Type\string(), Type\mixed()),
            'eventId' => Type\optional(Type\nullable(Type\string())),
            'joinedBy' => Type\optional(Type\nullable(Type\string())),
        ])->coerce($stored);
        $eventId = $shape['eventId'] ?? null;
        $joinedBy = $shape['joinedBy'] ?? null;

        return new self(
            $shape['kind'],
            null === $shape['organisationId'] ? null : Uuid::fromString($shape['organisationId']),
            $shape['permission'],
            null === $shape['roleId'] ? null : Uuid::fromString($shape['roleId']),
            Vec\map($shape['only'], Uuid::fromString(...)),
            Vec\map($shape['except'], Uuid::fromString(...)),
            $shape['conditions'],
            null === $eventId ? null : Uuid::fromString($eventId),
            null === $joinedBy ? null : new DateTimeImmutable($joinedBy),
        );
    }
}
