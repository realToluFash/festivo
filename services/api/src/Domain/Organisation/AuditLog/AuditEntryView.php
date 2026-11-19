<?php

declare(strict_types=1);

namespace App\Domain\Organisation\AuditLog;

use App\Domain\User\Mail\UserMailer;
use App\Entity\AuditEntry;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\AuditType;
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
    private const array UNSHOWN_FIELDS = ['export', 'eventId', 'membershipId', 'invitationId', 'userId', 'organisationId', 'claimId'];

    public function __construct(
        private TranslatorInterface $translator,
        private UserMailer $userMailer,
        private Connection $connection,
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
                ...$this->facts($entry, $context, $locale),
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
     * @param array{emails: array<string, ?string>, live: array<string, true>} $context
     *
     * @return array<string, mixed>
     */
    private function facts(AuditEntry $entry, array $context, string $locale): array
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
            'changes' => $this->changes($entry, $locale),
            'type' => $type->value,
            'action' => $entry->getAction(),
            'address' => $whereFrom ? $entry->getIp() : null,
            'device' => $whereFrom && null !== $entry->getUserAgent() ? $this->userMailer->named($entry->getUserAgent(), $locale) : null,
            'reference' => $entry->getCorrelationId() ?? $entry->getId()->toRfc4122(),
        ];
    }

    /** @return list<string> "Everyone needs two-factor: Off → On", one per field a reader can make sense of */
    private function changes(AuditEntry $entry, string $locale): array
    {
        $lines = [];

        foreach ($entry->getChanges() as $field => [$before, $after]) {
            if (Iter\contains(self::UNSHOWN_FIELDS, $field)) {
                continue;
            }

            $lines[] = $this->translator->trans('audit.change', [
                'field' => $this->fieldName($field, $locale),
                'before' => $this->value($before, $locale),
                'after' => $this->value($after, $locale),
            ], 'messages', $locale);
        }

        return $lines;
    }

    private function fieldName(string $field, string $locale): string
    {
        $key = 'audit.field.' . $field;
        $named = $this->translator->trans($key, [], 'messages', $locale);

        if ($named !== $key) {
            return $named;
        }

        return Str\capitalize(Str\lowercase(Regex\replace($field, '/(?<=[a-z0-9])([A-Z])/', ' $1')));
    }

    private function value(mixed $value, string $locale): string
    {
        return match (true) {
            null === $value => '—',
            true === $value => $this->translator->trans('audit.value.on', [], 'messages', $locale),
            false === $value => $this->translator->trans('audit.value.off', [], 'messages', $locale),
            \is_string($value) => '' === $value ? '—' : $value,
            \is_int($value), \is_float($value) => (string) $value,
            default => Json\encode($value),
        };
    }

    /** @return array{emails: array<string, ?string>, live: array<string, true>} */
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

        return ['emails' => $emails, 'live' => Type\dict(Type\string(), Type\literal_scalar(true))->coerce($live)];
    }
}
