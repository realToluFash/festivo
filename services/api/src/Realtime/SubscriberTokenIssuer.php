<?php

declare(strict_types=1);

namespace App\Realtime;

use App\Entity\User;
use App\Enum\RealtimeTopic;
use DateTimeImmutable;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Psl\Type;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** A hub subscriber token naming only topics the caller may read, signed with the key the hub accepts for subscribing and never for publishing. */
final readonly class SubscriberTokenIssuer
{
    public const int LIFETIME_SECONDS = 900;

    public function __construct(
        #[SensitiveParameter]
        private string $mercureSubscriberKey,
        private ClockInterface $clock,
    ) {
    }

    public function issueFor(User $user): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::UserNotifications->for($user->getId()->toRfc4122())]);
    }

    /** One event's seating, for someone the route has already found holds seating.read on it (sc-3998). */
    public function issueForEventSeating(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventSeating->for($eventId->toRfc4122())]);
    }

    /** One event's guest list and its headcount, for someone the route has already found holds guests.read on it (sc-1468, sc-99). */
    public function issueForEventGuests(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventGuests->for($eventId->toRfc4122()), RealtimeTopic::EventHeadcount->for($eventId->toRfc4122())]);
    }

    /** @param list<string> $topics */
    private function issue(array $topics): IssuedSubscriberToken
    {
        $configuration = Configuration::forSymmetricSigner(new Sha256(), InMemory::plainText(Type\non_empty_string()->coerce($this->mercureSubscriberKey)));
        $now = DateTimeImmutable::createFromInterface($this->clock->now());
        $expiresAt = $now->modify('+' . self::LIFETIME_SECONDS . ' seconds');

        $token = $configuration->builder()
            ->issuedAt($now)
            ->expiresAt($expiresAt)
            ->withClaim('mercure', ['subscribe' => $topics])
            ->getToken($configuration->signer(), $configuration->signingKey());

        return new IssuedSubscriberToken($token->toString(), $expiresAt);
    }
}
