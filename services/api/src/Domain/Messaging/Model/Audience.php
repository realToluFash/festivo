<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\NotificationAudienceKind;
use App\Enum\Permission;
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
     */
    private function __construct(
        public NotificationAudienceKind $kind,
        public ?Uuid $organisationId,
        public ?Permission $permission = null,
        public ?Uuid $roleId = null,
        public array $only = [],
        public array $except = [],
        public array $conditions = [],
    ) {
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
        ])->coerce($stored);

        return new self(
            $shape['kind'],
            null === $shape['organisationId'] ? null : Uuid::fromString($shape['organisationId']),
            $shape['permission'],
            null === $shape['roleId'] ? null : Uuid::fromString($shape['roleId']),
            Vec\map($shape['only'], Uuid::fromString(...)),
            Vec\map($shape['except'], Uuid::fromString(...)),
            $shape['conditions'],
        );
    }
}
