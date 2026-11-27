<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Domain\Messaging\Audience\GuestAudienceResolver;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\PlannedDelivery;
use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\DeliveryNotSentReason;
use App\Enum\GuestChannel;
use App\Repository\GuestRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Who a message reaches by email and why the rest can't be told (sc-3942, an opt-out sc-3969): the check before Send and the send itself read this one rule, so their counts never drift. */
final readonly class GuestReach
{
    private const int CHUNK = 500;

    public function __construct(
        private GuestAudienceResolver $guestAudienceResolver,
        private GuestRepository $guestRepository,
        private GuestSuppressions $guestSuppressions,
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
        $stopped = $this->guestSuppressions->among($event->getOrganisation()->getId(), GuestChannel::Email, Vec\filter_nulls(Vec\map(Vec\values($guests), static fn (Guest $guest): ?string => $guest->getEmail())));

        return Vec\filter_nulls(Vec\map($ids, static function (Uuid $id) use ($guests, $stopped): ?PlannedDelivery {
            $guest = $guests[$id->toRfc4122()] ?? null;

            if (null === $guest) {
                return null;
            }

            $address = $guest->getEmail();
            $reason = match (true) {
                null === $address || '' === $address => DeliveryNotSentReason::NoAddress,
                $guest->isEmailBouncing() => DeliveryNotSentReason::Bouncing,
                isset($stopped[$address]) => $stopped[$address]->notSent(),
                default => null,
            };

            return new PlannedDelivery($id, $guest->getFullName() ?? '', '' === $address ? null : $address, $reason);
        }));
    }
}
