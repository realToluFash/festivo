<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Domain\Messaging\Audience\GuestAudienceResolver;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\PlannedDelivery;
use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\DeliveryNotSentReason;
use App\Enum\MailProviderReport;
use App\Repository\GuestRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Who a message reaches by email and why the rest can't be told (sc-3942): the check before Send and the send itself read this one rule, so their counts never drift. */
final readonly class GuestReach
{
    private const int CHUNK = 500;

    public function __construct(
        private GuestAudienceResolver $guestAudienceResolver,
        private GuestRepository $guestRepository,
        private Connection $connection,
    ) {
    }

    /** @return list<PlannedDelivery> one per guest in the audience, in the resolver's order */
    public function plan(Event $event, Audience $audience): array
    {
        $ids = [];
        $after = null;

        do {
            $chunk = $this->guestAudienceResolver->resolve($audience, $after, self::CHUNK);
            $ids = [...$ids, ...$chunk];
            $after = Iter\last($chunk);
        } while (self::CHUNK === Iter\count($chunk));

        if ([] === $ids) {
            return [];
        }

        $guests = Dict\from_entries(Vec\map(
            Type\vec(Type\instance_of(Guest::class))->coerce($this->guestRepository->findBy(['id' => $ids])),
            static fn (Guest $guest): array => [$guest->getId()->toRfc4122(), $guest],
        ));
        $complained = $this->complainedAmong($event, Vec\filter_nulls(Vec\map($guests, static fn (Guest $guest): ?string => $guest->getEmail())));

        return Vec\filter_nulls(Vec\map($ids, static function (Uuid $id) use ($guests, $complained): ?PlannedDelivery {
            $guest = $guests[$id->toRfc4122()] ?? null;

            if (null === $guest) {
                return null;
            }

            $address = $guest->getEmail();
            $reason = match (true) {
                null === $address || '' === $address => DeliveryNotSentReason::NoAddress,
                $guest->isEmailBouncing() => DeliveryNotSentReason::Bouncing,
                Iter\contains($complained, self::key($address)) => DeliveryNotSentReason::Complained,
                default => null,
            };

            return new PlannedDelivery($id, $guest->getFullName() ?? '', '' === $address ? null : $address, $reason);
        }));
    }

    /**
     * A complaint stops this organisation's later email to the address, and only this organisation's (RFC 6449 §4.3.1).
     *
     * @param list<string> $addresses
     *
     * @return list<string> lowercased
     */
    private function complainedAmong(Event $event, array $addresses): array
    {
        if ([] === $addresses) {
            return [];
        }

        return Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT DISTINCT LOWER(d.address)
                FROM notification_deliveries d
                JOIN events e ON e.id = d.event_id
                WHERE e.organisation_id = :organisation
                  AND d.provider_report = :complained
                  AND LOWER(d.address) IN (:addresses)
                SQL,
            [
                'organisation' => $event->getOrganisation()->getId()->toRfc4122(),
                'complained' => MailProviderReport::Complained->value,
                'addresses' => Vec\map($addresses, self::key(...)),
            ],
            ['addresses' => ArrayParameterType::STRING],
        ));
    }

    private static function key(string $address): string
    {
        return Str\lowercase(Str\trim($address));
    }
}
