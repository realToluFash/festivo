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

/** Keyed hashes (RFC 2104) of the addresses an organisation no longer reaches, so neither erasure nor purge lifts them (sc-3969). */
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

    /** A STOP to Soirely's number stops every organisation's texts, those that come later too, and outdoes an earlier switch back on (sc-3946). */
    public function stopTextsEverywhere(string $number): void
    {
        $hash = $this->hash($number);
        $this->connection->transactional(function () use ($hash): void {
            $this->connection->executeStatement(
                'INSERT INTO text_stops (address_hash, stopped_at) VALUES (:hash, :now) ON CONFLICT (address_hash) DO NOTHING',
                ['hash' => $hash, 'now' => $this->clock->now()],
                ['now' => Types::DATETIME_IMMUTABLE],
            );
            $this->connection->executeStatement('DELETE FROM text_stop_lifts WHERE address_hash = :hash', ['hash' => $hash]);
        });
    }

    /** START there resumes them all, one stopped by the switch too; a complaint stays (sc-3946). */
    public function resumeTextsEverywhere(string $number): void
    {
        $hash = $this->hash($number);
        $this->connection->transactional(function () use ($hash): void {
            $this->connection->executeStatement('DELETE FROM text_stops WHERE address_hash = :hash', ['hash' => $hash]);
            $this->connection->executeStatement('DELETE FROM text_stop_lifts WHERE address_hash = :hash', ['hash' => $hash]);
            $this->connection->executeStatement(
                'DELETE FROM guest_suppressions WHERE address_hash = :hash AND channel = :texts AND reason = :optedOut',
                ['hash' => $hash, 'texts' => GuestChannel::Texts->value, 'optedOut' => GuestSuppressionReason::OptedOut->value],
            );
        });
    }

    /** The guest's own word lifts a complaint too. */
    public function lift(Uuid $organisation, GuestChannel $channel, string $address): void
    {
        if (GuestChannel::Texts === $channel) {
            $this->connection->executeStatement(
                <<<'SQL'
                    INSERT INTO text_stop_lifts (organisation_id, address_hash)
                    SELECT :organisation, address_hash FROM text_stops WHERE address_hash = :hash
                    ON CONFLICT DO NOTHING
                    SQL,
                ['organisation' => $organisation->toRfc4122(), 'hash' => $this->hash($address)],
            );
        }

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

        return false === $at ? $this->stoppedEverywhereSince($organisation, $channel, $address) : new DateTimeImmutable(Type\string()->coerce($at));
    }

    /** When the guest stopped this organisation's messages on the channel, by their own word; a complaint is not an opt-out, and the migration's date for one is not the guest's. */
    public function optedOutSince(Uuid $organisation, GuestChannel $channel, ?string $address): ?DateTimeImmutable
    {
        if (null === $address || '' === $address) {
            return null;
        }

        $at = $this->connection->fetchOne(
            'SELECT suppressed_at FROM guest_suppressions WHERE organisation_id = :organisation AND channel = :channel AND address_hash = :hash AND reason <> :complained',
            ['organisation' => $organisation->toRfc4122(), 'channel' => $channel->value, 'hash' => $this->hash($address), 'complained' => GuestSuppressionReason::Complained->value],
        );

        return false === $at ? $this->stoppedEverywhereSince($organisation, $channel, $address) : new DateTimeImmutable(Type\string()->coerce($at));
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

        if (GuestChannel::Texts === $channel) {
            $kept += Dict\from_keys(Vec\keys($this->stoppedEverywhere($organisation, Vec\values($byHash))), static fn (): GuestSuppressionReason => GuestSuppressionReason::OptedOut);
        }

        return Dict\filter_nulls(Dict\map($byHash, static fn (string $hash): ?GuestSuppressionReason => $kept[$hash] ?? null));
    }

    private function stoppedEverywhereSince(Uuid $organisation, GuestChannel $channel, string $address): ?DateTimeImmutable
    {
        if (GuestChannel::Texts !== $channel) {
            return null;
        }

        $hash = $this->hash($address);

        return $this->stoppedEverywhere($organisation, [$hash])[$hash] ?? null;
    }

    /**
     * @param list<string> $hashes
     *
     * @return array<string, DateTimeImmutable> when each of them texted STOP to Soirely's number, less those switched back on for this organisation since
     */
    private function stoppedEverywhere(Uuid $organisation, array $hashes): array
    {
        $rows = Type\vec(Type\shape(['address_hash' => Type\string(), 'stopped_at' => Type\string()]))->coerce($this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT s.address_hash, s.stopped_at
                FROM text_stops s
                WHERE s.address_hash IN (:hashes)
                  AND NOT EXISTS (SELECT 1 FROM text_stop_lifts l WHERE l.address_hash = s.address_hash AND l.organisation_id = :organisation)
                SQL,
            ['organisation' => $organisation->toRfc4122(), 'hashes' => $hashes],
            ['hashes' => ArrayParameterType::STRING],
        ));

        return Dict\from_entries(Vec\map($rows, static fn (array $row): array => [$row['address_hash'], new DateTimeImmutable($row['stopped_at'])]));
    }

    private function hash(string $address): string
    {
        if ('' === $this->key) {
            throw new LogicException('GUEST_COMPLAINT_KEY is not set.');
        }

        return \hash_hmac('sha256', Str\lowercase(Str\trim($address)), $this->key);
    }
}
