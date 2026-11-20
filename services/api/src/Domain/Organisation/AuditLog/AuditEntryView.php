<?php

declare(strict_types=1);

namespace App\Domain\Organisation\AuditLog;

use App\Domain\Organisation\Roles\SeededRoleLabels;
use App\Domain\User\Mail\UserMailer;
use App\Entity\AuditEntry;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\AuditType;
use App\Enum\SeededRole;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class AuditEntryView
{
    /** Ids, coordinates, file keys and internal stamps: recorded for the trail, never a change a reader is shown (sc-611, #74875). */
    public const array UNSHOWN_FIELDS = ['deletedAt', 'export', 'eventId', 'membershipId', 'userId', 'organisation', 'user', 'claimant', 'duplicatedFrom', 'newOwnerRoleId', 'owner', 'venueCoordinates', 'photo'];

    private const array ROLE_FIELDS = ['role', 'roleId'];

    private const array CODED_FIELDS = ['role', 'roleId', 'status', 'membershipStatus', 'suspension', 'type', 'addressKind', 'plan', 'requestLink', 'onlyOurs', 'outcome', 'path'];

    private const string UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';

    private const string INSTANT = '/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$/';

    public function __construct(
        private TranslatorInterface $translator,
        private UserMailer $userMailer,
        private Connection $connection,
        private SeededRoleLabels $seededRoleLabels,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function shown(User $reader, string $locale, AuditEntry ...$entries): array
    {
        $context = $this->context(...$entries);

        return Vec\map($entries, function (AuditEntry $entry) use ($context, $reader, $locale): array {
            [$day, $time] = UserMailer::dayAndTime($entry->getOccurredAt(), $reader);

            return [
                'id' => $entry->getId()->toRfc4122(),
                'at' => $entry->getOccurredAt()->format('Y-m-d\TH:i:s\Z'),
                'day' => $day,
                'time' => $time,
                'when' => $this->userMailer->stamp($entry->getOccurredAt(), $reader, $locale),
                ...$this->facts($entry, $context, $locale, $reader),
            ];
        });
    }

    /** @return list<array<string, ?string>> */
    public function exported(string $locale, AuditEntry ...$entries): array
    {
        $context = $this->context(...$entries);

        return Vec\map($entries, function (AuditEntry $entry) use ($context, $locale): array {
            $facts = $this->facts($entry, $context, $locale);
            $who = Type\shape(['kind' => Type\string(), 'name' => Type\nullable(Type\string()), 'email' => Type\nullable(Type\string())])->coerce($facts['who']);
            $on = Type\nullable(Type\shape(['name' => Type\string(), 'eventId' => Type\nullable(Type\string()), 'gone' => Type\bool()]))->coerce($facts['on']);

            return [
                'occurred_at' => $entry->getOccurredAt()->format('Y-m-d\TH:i:s\Z'),
                'type' => Type\string()->coerce($facts['type']),
                'type_name' => $this->translator->trans('audit.type.' . Type\string()->coerce($facts['type']), [], 'messages', $locale),
                'action' => $entry->getAction(),
                'what' => Type\string()->coerce($facts['what']),
                'who' => $this->whoName($who['kind'], $who['name'], $locale),
                'who_email' => $who['email'],
                'on' => match (true) {
                    null === $on => null,
                    $on['gone'] => $this->translator->trans('audit.gone', ['name' => $on['name']], 'messages', $locale),
                    default => $on['name'],
                },
                'changes' => Str\join(Type\vec(Type\string())->coerce($facts['changes']), '; '),
                'network_address' => Type\nullable(Type\string())->coerce($facts['address']),
                'device' => Type\nullable(Type\string())->coerce($facts['device']),
                'reference' => Type\string()->coerce($facts['reference']),
            ];
        });
    }

    /** @return list<string> the export's columns, in order */
    public static function columns(): array
    {
        return ['occurred_at', 'type', 'type_name', 'action', 'what', 'who', 'who_email', 'on', 'changes', 'network_address', 'device', 'reference'];
    }

    public function whoName(string $kind, ?string $name, string $locale): string
    {
        return match ($kind) {
            'support' => $this->translator->trans('audit.who.support', [], 'messages', $locale),
            'system' => $this->translator->trans('audit.who.system', [], 'messages', $locale),
            default => $name ?? '',
        };
    }

    /**
     * @param array{emails: array<string, ?string>, live: array<string, true>, roles: array<string, string>} $context
     *
     * @return array<string, mixed>
     */
    private function facts(AuditEntry $entry, array $context, string $locale, ?User $reader = null): array
    {
        $type = AuditType::of($entry->getAction()) ?? AuditType::Organisation;
        $actorId = $entry->getActorId()?->toRfc4122();
        $eventId = $entry->getEventId()?->toRfc4122();
        $whereFrom = $type->showsWhereFrom();

        return [
            'who' => match ($entry->getActorType()) {
                Actor::User => [
                    'kind' => 'person',
                    'name' => $entry->getActorLabel(),
                    'email' => null === $actorId ? null : $context['emails'][$actorId] ?? null,
                ],
                Actor::Agent => ['kind' => 'support', 'name' => null, 'email' => null],
                Actor::System, Actor::ApiClient => ['kind' => 'system', 'name' => null, 'email' => null],
            },
            'what' => $this->translator->trans('audit.what.' . $entry->getAction(), [
                'target' => $entry->getTarget() ?? $this->translator->trans('audit.unnamed', [], 'messages', $locale),
                'event' => $entry->getEventName() ?? $this->translator->trans('audit.unnamed', [], 'messages', $locale),
            ], 'messages', $locale),
            'on' => null === $eventId ? null : [
                'name' => $entry->getEventName() ?? $this->translator->trans('audit.unnamed', [], 'messages', $locale),
                'eventId' => Iter\contains_key($context['live'], $eventId) ? $eventId : null,
                'gone' => !Iter\contains_key($context['live'], $eventId),
            ],
            'changes' => $this->changes($entry, $context['roles'], $locale, $reader),
            'type' => $type->value,
            'action' => $entry->getAction(),
            'address' => $whereFrom ? $entry->getIp() : null,
            'device' => $whereFrom && null !== $entry->getUserAgent() ? $this->userMailer->named($entry->getUserAgent(), $locale) : null,
            'reference' => $entry->getCorrelationId() ?? $entry->getId()->toRfc4122(),
        ];
    }

    /**
     * @param array<string, string> $roles role id => the role it was seeded as
     *
     * @return list<string> "Everyone needs two-factor: Off → On", one per shown field that changed and has a name in audit.field.*
     */
    private function changes(AuditEntry $entry, array $roles, string $locale, ?User $reader): array
    {
        if (Iter\contains(AuditType::CREATES_OR_REMOVES, $entry->getAction())) {
            return [];
        }

        $lines = [];

        foreach ($entry->getChanges() as $field => [$before, $after]) {
            $name = Iter\contains(self::UNSHOWN_FIELDS, $field) ? null : $this->fieldName($field, $locale);

            if (null === $name) {
                continue;
            }

            $was = $this->value($field, $before, $roles, $locale, $reader);
            $now = $this->value($field, $after, $roles, $locale, $reader);

            if (null === $was || null === $now || $was === $now) {
                continue;
            }

            $lines[] = $this->translator->trans('audit.change', [
                'field' => $name,
                'before' => $was,
                'after' => $now,
            ], 'messages', $locale);
        }

        return $lines;
    }

    private function fieldName(string $field, string $locale): ?string
    {
        $key = 'audit.field.' . $field;
        $named = $this->translator->trans($key, [], 'messages', $locale);

        return $named !== $key ? $named : null;
    }

    /** @param array<array-key, mixed> $filters as an export recorded them: "Action type: Members and invitations, From: 2026-11-01" */
    private function filters(array $filters, string $locale): string
    {
        $none = $this->translator->trans('audit.unnamed', [], 'messages', $locale);

        return Str\join(Vec\map_with_key($filters, fn (int|string $filter, mixed $value): string => $this->translator->trans('audit.filter.pair', [
            'field' => $this->translator->trans('audit.filter.' . $filter, [], 'messages', $locale),
            'value' => match (true) {
                'type' === $filter && \is_string($value) => $this->translator->trans('audit.type.' . $value, [], 'messages', $locale),
                \is_string($value) => $value,
                default => $none,
            },
        ], 'messages', $locale)), ', ');
    }

    /**
     * @param array<string, string> $roles
     *
     * @return ?string null for a value no reader could make sense of, such as another record's id; a role since removed reads as none
     */
    private function value(string $field, mixed $value, array $roles, string $locale, ?User $reader): ?string
    {
        $isRole = Iter\contains(self::ROLE_FIELDS, $field);
        $coded = Iter\contains(self::CODED_FIELDS, $field);

        return match (true) {
            'filters' === $field && \is_array($value) && [] !== $value => $this->filters($value, $locale),
            null === $value, '' === $value, [] === $value => $this->translator->trans('audit.value.none', [], 'messages', $locale),
            true === $value => $this->translator->trans('audit.value.on', [], 'messages', $locale),
            false === $value => $this->translator->trans('audit.value.off', [], 'messages', $locale),
            \is_int($value), \is_float($value) => (string) $value,
            \is_string($value) && Regex\matches($value, self::UUID) && $isRole => $this->role($roles[$value] ?? null, $locale),
            \is_string($value) && Regex\matches($value, self::UUID) => null,
            \is_string($value) && Regex\matches($value, self::INSTANT) => $this->instant(new DateTimeImmutable($value), $locale, $reader),
            \is_string($value) && $isRole && null !== SeededRole::tryFrom($value) => $this->role($value, $locale),
            \is_string($value) => $coded ? $this->code($value, $locale) : $value,
            \is_array($value) && Iter\all($value, static fn (mixed $one): bool => \is_string($one)) => Str\join(Type\vec(Type\string())->coerce($value), ', '),
            default => Json\encode($value),
        };
    }

    private function role(?string $seededAs, string $locale): string
    {
        $seeded = null === $seededAs ? null : SeededRole::tryFrom($seededAs);

        return null === $seeded
            ? $this->translator->trans('audit.value.none', [], 'messages', $locale)
            : $this->seededRoleLabels->label($seeded, $locale);
    }

    /** A stored code in words: "can_edit" reads "Can edit", from audit.value.* where it has a word of its own. */
    private function code(string $code, string $locale): string
    {
        $key = 'audit.value.' . $code;
        $named = $this->translator->trans($key, [], 'messages', $locale);

        return $named !== $key ? $named : Str\capitalize(Str\replace($code, '_', ' '));
    }

    /** On screen in the reader's zone, as the entry's own time is; in the export in UTC, as its occurred_at is. */
    private function instant(DateTimeImmutable $at, string $locale, ?User $reader): string
    {
        return null === $reader
            ? $at->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z')
            : $this->userMailer->stamp($at, $reader, $locale);
    }

    /** @return array{emails: array<string, ?string>, live: array<string, true>, roles: array<string, string>} */
    private function context(AuditEntry ...$entries): array
    {
        $actors = Vec\unique(Vec\filter_nulls(Vec\map($entries, static fn (AuditEntry $entry): ?string => Actor::User === $entry->getActorType() ? $entry->getActorId()?->toRfc4122() : null)));
        $events = Vec\unique(Vec\filter_nulls(Vec\map($entries, static fn (AuditEntry $entry): ?string => $entry->getEventId()?->toRfc4122())));

        $emails = [] === $actors ? [] : Dict\pull(
            Type\vec(Type\shape(['id' => Type\string(), 'address' => Type\nullable(Type\string())]))->coerce($this->connection->fetchAllAssociative(<<<'SQL'
                SELECT u.id::text AS id, e.address
                FROM   users u
                LEFT JOIN email_addresses e ON e.user_id = u.id AND e.is_primary
                WHERE  u.id::text IN (:ids)
                  AND  u.deleted_at IS NULL
                SQL, ['ids' => $actors], ['ids' => ArrayParameterType::STRING])),
            static fn (array $row): ?string => $row['address'],
            static fn (array $row): string => $row['id'],
        );

        $live = [] === $events ? [] : Dict\from_keys(
            Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(<<<'SQL'
                SELECT id::text
                FROM   events
                WHERE  id::text IN (:ids)
                  AND  deleted_at IS NULL
                SQL, ['ids' => $events], ['ids' => ArrayParameterType::STRING])),
            static fn (): bool => true,
        );

        $roleIds = Vec\unique(Type\vec(Type\string())->coerce(Vec\filter(
            Vec\flat_map($entries, static fn (AuditEntry $entry): array => Vec\flat_map(Vec\values($entry->getChanges()), static fn (array $pair): array => Vec\values($pair))),
            static fn (mixed $value): bool => \is_string($value) && Regex\matches($value, self::UUID),
        )));

        $organisations = Vec\unique(Vec\filter_nulls(Vec\map($entries, static fn (AuditEntry $entry): ?string => $entry->getOrganisationId()?->toRfc4122())));

        $roles = [] === $roleIds || [] === $organisations ? [] : Dict\pull(
            Type\vec(Type\shape(['id' => Type\string(), 'seeded_as' => Type\string()]))->coerce($this->connection->fetchAllAssociative(<<<'SQL'
                SELECT id::text AS id, seeded_as
                FROM   roles
                WHERE  id::text IN (:ids)
                  AND  organisation_id::text IN (:organisations)
                SQL, ['ids' => $roleIds, 'organisations' => $organisations], ['ids' => ArrayParameterType::STRING, 'organisations' => ArrayParameterType::STRING])),
            static fn (array $row): string => $row['seeded_as'],
            static fn (array $row): string => $row['id'],
        );

        return ['emails' => $emails, 'live' => Type\dict(Type\string(), Type\literal_scalar(true))->coerce($live), 'roles' => $roles];
    }
}
