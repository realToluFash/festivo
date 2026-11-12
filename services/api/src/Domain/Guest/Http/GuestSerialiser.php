<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\GuestReply;
use App\Repository\GuestRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** An event's guest list, each companion under their host; the clients sort it by name (sc-1468). */
final readonly class GuestSerialiser
{
    public function __construct(
        private GuestRepository $guestRepository,
    ) {
    }

    /** @return array{guests: list<array<string, mixed>>, counts: array{people: int, guests: int, companions: int}} */
    public function list(Event $event): array
    {
        $everybody = $this->guestRepository->findOnList($event);
        $hosts = Vec\filter($everybody, static fn (Guest $guest): bool => null === $guest->getHost());
        $companions = Dict\group_by(
            Vec\filter($everybody, static fn (Guest $guest): bool => null !== $guest->getHost()),
            static fn (Guest $companion): string => $companion->getHost()?->getId()->toRfc4122() ?? '',
        );

        return [
            'guests' => Vec\map($hosts, static fn (Guest $host): array => self::guest($host, $companions[$host->getId()->toRfc4122()] ?? [])),
            'counts' => [
                'people' => Iter\count($everybody),
                'guests' => Iter\count($hosts),
                'companions' => Iter\count($everybody) - Iter\count($hosts),
            ],
        ];
    }

    /**
     * @param list<Guest> $companions
     *
     * @return array<string, mixed>
     */
    public static function guest(Guest $host, array $companions): array
    {
        $reply = $host->getReply() ?? GuestReply::NoReply;

        return [
            'id' => $host->getId()->toRfc4122(),
            'fullName' => $host->getFullName(),
            'email' => $host->getEmail(),
            'mobile' => $host->getMobile(),
            'reply' => $reply->value,
            'companions' => Vec\map($companions, static fn (Guest $companion): array => [
                'id' => $companion->getId()->toRfc4122(),
                'fullName' => $companion->getFullName(),
                'state' => GuestReply::Coming === $reply ? 'coming' : 'held',
            ]),
        ];
    }
}
