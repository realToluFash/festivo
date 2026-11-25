<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Enum\GuestChannel;
use App\Enum\GuestSuppressionReason;
use App\Enum\NotificationAudienceKind;
use DateTimeImmutable;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use LogicException;
use Psl\Dict;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;

/**
 * The one list of addresses an organisation no longer reaches, per channel (sc-3969, epic 36 §7): a guest's complaint (RFC 6449 §4.3.1) and the guest's own opt-out. Each address is kept as a keyed hash (RFC 2104) from the moment it lands, so neither the guest's erasure nor the event's purge lifts it, and an import of the same address meets it again.
 */
final readonly class GuestSuppressions
{
    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
        #[SensitiveParameter]
        #[Autowire('%env(GUEST_COMPLAINT_KEY)%')]
        private string $key,
    ) {
    }

    public function keepComplaint(string $deliveryId): void
    {
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT e.organisation_id, d.address
                FROM notification_deliveries d
                JOIN events e ON e.id = d.event_id
                WHERE d.id = :id
                  AND d.recipient_kind = :guest
                  AND d.address IS NOT NULL
                SQL,
            ['id' => $deliveryId, 'guest' => NotificationAudienceKind::Guest->value],
        );

        if (false !== $row) {
            $this->suppress(Uuid::fromString(Type\string()->coerce($row['organisation_id'])), GuestChannel::Email, Type\string()->coerce($row['address']), GuestSuppressionReason::Complained);
        }
    }

    /** A complaint replaces an opt-out already there; an opt-out never replaces a complaint, and keeps its first date. */
    public function suppress(Uuid $organisation, GuestChannel $channel, string $address, GuestSuppressionReason $reason): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO guest_suppressions (organisation_id, channel, address_hash, reason, suppressed_at)
                VALUES (:organisation, :channel, :hash, :reason, :now)
                ON CONFLICT (organisation_id, channel, address_hash) DO UPDATE SET reason = EXCLUDED.reason
                WHERE EXCLUDED.reason = :complained AND guest_suppressions.reason <> :complained
                SQL,
            [
                'organisation' => $organisation->toRfc4122(),
                'channel' => $channel->value,
                'hash' => $this->hash($address),
                'reason' => $reason->value,
                'now' => $this->clock->now(),
                'complained' => GuestSuppressionReason::Complained->value,
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }

    /** The guest's own word lifts a complaint too. */
    public function lift(Uuid $organisation, GuestChannel $channel, string $address): void
    {
        $this->connection->executeStatement(
            'DELETE FROM guest_suppressions WHERE organisation_id = :organisation AND channel = :channel AND address_hash = :hash',
            ['organisation' => $organisation->toRfc4122(), 'channel' => $channel->value, 'hash' => $this->hash($address)],
        );
    }

    public function since(Uuid $organisation, GuestChannel $channel, ?string $address): ?DateTimeImmutable
    {
        if (null === $address || '' === $address) {
            return null;
        }

        $at = $this->connection->fetchOne(
            'SELECT suppressed_at FROM guest_suppressions WHERE organisation_id = :organisation AND channel = :channel AND address_hash = :hash',
            ['organisation' => $organisation->toRfc4122(), 'channel' => $channel->value, 'hash' => $this->hash($address)],
        );

        return false === $at ? null : new DateTimeImmutable(Type\string()->coerce($at));
    }

    /**
     * @param list<string> $addresses
     *
     * @return array<string, GuestSuppressionReason> why each of them that this organisation no longer reaches on the channel is stopped, keyed as given
     */
    public function among(Uuid $organisation, GuestChannel $channel, array $addresses): array
    {
        if ([] === $addresses) {
            return [];
        }

        $byHash = Dict\from_keys($addresses, $this->hash(...));
        $kept = Dict\from_entries(Vec\map(
            Type\vec(Type\shape(['address_hash' => Type\string(), 'reason' => Type\string()]))->coerce($this->connection->fetchAllAssociative(
                'SELECT address_hash, reason FROM guest_suppressions WHERE organisation_id = :organisation AND channel = :channel AND address_hash IN (:hashes)',
                ['organisation' => $organisation->toRfc4122(), 'channel' => $channel->value, 'hashes' => Vec\values($byHash)],
                ['hashes' => ArrayParameterType::STRING],
            )),
            static fn (array $row): array => [$row['address_hash'], GuestSuppressionReason::from($row['reason'])],
        ));

        return Dict\filter_nulls(Dict\map($byHash, static fn (string $hash): ?GuestSuppressionReason => $kept[$hash] ?? null));
    }

    private function hash(string $address): string
    {
        if ('' === $this->key) {
            throw new LogicException('GUEST_COMPLAINT_KEY is not set.');
        }

        return \hash_hmac('sha256', Str\lowercase(Str\trim($address)), $this->key);
    }
}
