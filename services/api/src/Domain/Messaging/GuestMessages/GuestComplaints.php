<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Enum\MailProviderReport;
use App\Enum\NotificationAudienceKind;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;

/** The addresses each organisation's guests reported as spam (RFC 6449 §4.3.1): on the deliveries, and as a keyed hash (RFC 2104) once a removal takes the address off them. */
final readonly class GuestComplaints
{
    private const string PURPOSE = 'guest-complaint:';

    public function __construct(
        private Connection $connection,
        #[SensitiveParameter]
        #[Autowire('%kernel.secret%')]
        private string $secret,
    ) {
    }

    /**
     * @param list<string> $addresses
     *
     * @return list<string> those among them a guest of this organisation complained from, compared lowercased and trimmed
     */
    public function among(Uuid $organisation, array $addresses): array
    {
        if ([] === $addresses) {
            return [];
        }

        $keys = Vec\map($addresses, self::key(...));
        $byHash = Dict\from_keys($keys, $this->hash(...));
        $org = $organisation->toRfc4122();

        $onDeliveries = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT DISTINCT LOWER(TRIM(d.address))
                FROM notification_deliveries d
                JOIN events e ON e.id = d.event_id
                WHERE e.organisation_id = :organisation
                  AND d.provider_report = :complained
                  AND LOWER(TRIM(d.address)) IN (:addresses)
                SQL,
            ['organisation' => $org, 'complained' => MailProviderReport::Complained->value, 'addresses' => $keys],
            ['addresses' => ArrayParameterType::STRING],
        ));
        $kept = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'SELECT address_hash FROM guest_complaints WHERE organisation_id = :organisation AND address_hash IN (:hashes)',
            ['organisation' => $org, 'hashes' => Vec\values($byHash)],
            ['hashes' => ArrayParameterType::STRING],
        ));

        return Vec\unique([...$onDeliveries, ...Vec\keys(Dict\filter($byHash, static fn (string $hash): bool => Iter\contains($kept, $hash)))]);
    }

    /** @param list<string> $guestIds */
    public function keepBeforeErasing(array $guestIds): void
    {
        if ([] === $guestIds) {
            return;
        }

        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT DISTINCT e.organisation_id, LOWER(TRIM(d.address)) AS address
                FROM notification_deliveries d
                JOIN events e ON e.id = d.event_id
                WHERE d.recipient_kind = :guest
                  AND d.recipient_id IN (:ids)
                  AND d.provider_report = :complained
                  AND d.address IS NOT NULL
                SQL,
            ['guest' => NotificationAudienceKind::Guest->value, 'ids' => $guestIds, 'complained' => MailProviderReport::Complained->value],
            ['ids' => ArrayParameterType::STRING],
        );

        foreach ($rows as $row) {
            $this->connection->executeStatement(
                'INSERT INTO guest_complaints (organisation_id, address_hash) VALUES (:organisation, :hash) ON CONFLICT DO NOTHING',
                ['organisation' => $row['organisation_id'], 'hash' => $this->hash(Type\string()->coerce($row['address']))],
            );
        }
    }

    private function hash(string $key): string
    {
        return \hash_hmac('sha256', self::PURPOSE . $key, $this->secret);
    }

    private static function key(string $address): string
    {
        return Str\lowercase(Str\trim($address));
    }
}
