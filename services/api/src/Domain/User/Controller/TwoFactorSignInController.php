<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\Http\SecondFactorInput;
use App\Domain\User\TwoFactor\SignInGate;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The second half of a sign-in that was answered with a challenge: the code, then the tokens and `linked`. */
#[PublicAccess]
final readonly class TwoFactorSignInController
{
    public function __construct(
        private SignInGate $signInGate,
        private AccountSerialiser $accountSerialiser,
        private SecondFactorInput $secondFactorInput,
    ) {
    }

    /** A new challenge for the passkey sheet, each time it opens. */
    #[Route('/api/auth/two-factor/passkey-options', name: 'auth_two_factor_passkey_sign_in_options', methods: ['POST'])]
    public function passkeyOptions(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['challenge' => Type\string()]));

        return new JsonResponse($this->signInGate->passkeyOptions($body['challenge']));
    }

    #[Route('/api/auth/two-factor/verify', name: 'auth_two_factor_verify', methods: ['POST'])]
    public function verify(Request $request): IssuedTokensResponse
    {
        $body = Input::body($request, Type\shape([
            'challenge' => Type\string(),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
            ...SecondFactorInput::fields(),
        ]));
        $delivery = $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body;
        $result = $this->signInGate->complete($body['challenge'], $this->secondFactorInput->separate($body), $request, RefreshTokenDelivery::Cookie === $delivery);

        return new IssuedTokensResponse(
            $result->tokens,
            $delivery,
            $request,
            ['account' => $this->accountSerialiser->serialise($result->user, $result->tokens), 'linked' => $result->linked],
        );
    }
}
