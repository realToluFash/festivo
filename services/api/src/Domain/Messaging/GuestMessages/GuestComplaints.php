<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Enum\NotificationAudienceKind;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use LogicException;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;

/** The addresses each organisation's guests reported as spam (RFC 6449 §4.3.1), kept as a keyed hash (RFC 2104) from the moment the report lands, so neither the guest's removal nor the event's purge lifts it. */
final readonly class GuestComplaints
{
    public function __construct(
        private Connection $connection,
        #[SensitiveParameter]
        #[Autowire('%env(GUEST_COMPLAINT_KEY)%')]
        private string $key,
    ) {
    }

    /** Keeps the complaint against the guest delivery it names; any other delivery is not a guest's and keeps nothing. */
    public function keep(string $deliveryId): void
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

        if (false === $row) {
            return;
        }

        $this->connection->executeStatement(
            'INSERT INTO guest_complaints (organisation_id, address_hash) VALUES (:organisation, :hash) ON CONFLICT DO NOTHING',
            ['organisation' => $row['organisation_id'], 'hash' => $this->hash(Type\string()->coerce($row['address']))],
        );
    }

    /**
     * @param list<string> $addresses
     *
     * @return list<string> those among them a guest of this organisation complained from, as given
     */
    public function among(Uuid $organisation, array $addresses): array
    {
        if ([] === $addresses) {
            return [];
        }

        $byHash = Dict\from_keys($addresses, $this->hash(...));
        $kept = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'SELECT address_hash FROM guest_complaints WHERE organisation_id = :organisation AND address_hash IN (:hashes)',
            ['organisation' => $organisation->toRfc4122(), 'hashes' => Vec\values($byHash)],
            ['hashes' => ArrayParameterType::STRING],
        ));

        return Vec\keys(Dict\filter($byHash, static fn (string $hash): bool => Iter\contains($kept, $hash)));
    }

    private function hash(string $address): string
    {
        if ('' === $this->key) {
            throw new LogicException('GUEST_COMPLAINT_KEY is not set.');
        }

        return \hash_hmac('sha256', self::normalised($address), $this->key);
    }

    private static function normalised(string $address): string
    {
        return Str\lowercase(Str\trim($address));
    }
}
