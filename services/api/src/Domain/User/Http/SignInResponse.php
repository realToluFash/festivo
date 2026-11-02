<?php

declare(strict_types=1);

namespace App\Domain\User\Http;

use App\Domain\User\Model\IssuedChallenge;
use App\Domain\User\Model\IssuedTokens;
use App\Entity\User;
use App\Enum\RefreshTokenDelivery;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/** Tokens and the account, or a 202 with the two-factor challenge and nothing about the account. */
final readonly class SignInResponse
{
    public function __construct(
        private AccountSerialiser $accountSerialiser,
    ) {
    }

    /** @param array<string, mixed> $alongside */
    public function for(
        IssuedTokens|IssuedChallenge $admission,
        User $user,
        RefreshTokenDelivery $delivery,
        Request $request,
        array $alongside = [],
    ): JsonResponse {
        if ($admission instanceof IssuedTokens) {
            return new IssuedTokensResponse($admission, $delivery, $request, ['account' => $this->accountSerialiser->serialise($user)] + $alongside);
        }

        // Nothing alongside a challenge: whatever it would say waits on the code.
        return new JsonResponse([
            'twoFactorChallenge' => $admission->token,
            'challengeExpiresAt' => $admission->expiresAt->format(\DATE_ATOM),
            'email' => $user->getPrimaryEmailAddress()?->getAddress(),
        ], Response::HTTP_ACCEPTED);
    }
}
