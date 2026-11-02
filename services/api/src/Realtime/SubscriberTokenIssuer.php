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

/** A hub subscriber token naming only the caller's own topics, signed with the key the hub accepts for subscribing and never for publishing. */
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
        $configuration = Configuration::forSymmetricSigner(new Sha256(), InMemory::plainText(Type\non_empty_string()->coerce($this->mercureSubscriberKey)));
        $now = DateTimeImmutable::createFromInterface($this->clock->now());
        $expiresAt = $now->modify('+' . self::LIFETIME_SECONDS . ' seconds');

        $token = $configuration->builder()
            ->issuedAt($now)
            ->expiresAt($expiresAt)
            ->withClaim('mercure', ['subscribe' => [RealtimeTopic::UserNotifications->for($user->getId()->toRfc4122())]])
            ->getToken($configuration->signer(), $configuration->signingKey());

        return new IssuedSubscriberToken($token->toString(), $expiresAt);
    }
}
