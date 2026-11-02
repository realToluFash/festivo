<?php

declare(strict_types=1);

namespace App\Domain\User;

use Lexik\Bundle\JWTAuthenticationBundle\Security\Authenticator\Token\JWTPostAuthenticationToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Uid\Uuid;

/** The session the request's access token belongs to: its own claim, not an id the client names. */
final readonly class CallerSession
{
    public function __construct(
        private Security $security,
        private JWTTokenManagerInterface $jwtTokenManager,
    ) {
    }

    public function chain(): ?Uuid
    {
        $token = $this->security->getToken();

        if (!$token instanceof JWTPostAuthenticationToken) {
            return null;
        }

        $session = $this->jwtTokenManager->parse($token->getCredentials())[TokenIssuer::SESSION_CLAIM] ?? null;

        return \is_string($session) && Uuid::isValid($session) ? Uuid::fromString($session) : null;
    }
}
