<?php

declare(strict_types=1);

namespace App\Domain\User\Listener;

use App\Domain\User\RevokedSessions;
use App\Domain\User\TokenIssuer;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTDecodedEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Events;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\Uid\Uuid;

/** An ended session's access token is refused as an expired one is: marked invalid, TokenRefusalListener answers. */
#[AsEventListener(event: Events::JWT_DECODED)]
final readonly class RevokedSessionListener
{
    public function __construct(
        private RevokedSessions $revokedSessions,
    ) {
    }

    public function __invoke(JWTDecodedEvent $event): void
    {
        $session = $event->getPayload()[TokenIssuer::SESSION_CLAIM] ?? null;

        if (!\is_string($session) || !Uuid::isValid($session)) {
            return;
        }

        if ($this->revokedSessions->includes(Uuid::fromString($session))) {
            $event->markAsInvalid();
        }
    }
}
