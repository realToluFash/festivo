<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\AccountSerialiser;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Domain\User\TwoFactor\SignInGate;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\CodeField;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The second half of a sign-in that was answered with a challenge: the code, then the tokens and `linked`. */
#[PublicAccess]
final readonly class TwoFactorSignInController
{
    public function __construct(
        private SignInGate $signInGate,
        private AccountSerialiser $accountSerialiser,
        private CodeField $codeField,
    ) {
    }

    #[Route('/api/auth/two-factor/verify', name: 'auth_two_factor_verify', methods: ['POST'])]
    public function verify(Request $request): IssuedTokensResponse
    {
        $body = Input::body($request, Type\shape([
            'challenge' => Type\string(),
            'code' => Type\optional(Type\mixed()),
            'recoveryCode' => Type\optional(Type\mixed()),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
        $code = $this->codeField->optional($body, 'code', CodeField::FROM_APP);
        $recoveryCode = $this->codeField->optional($body, 'recoveryCode', CodeField::RECOVERY);

        $result = $this->signInGate->complete($body['challenge'], $code, $recoveryCode, $request);

        return new IssuedTokensResponse(
            $result->tokens,
            $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body,
            $request,
            ['account' => $this->accountSerialiser->serialise($result->user), 'linked' => $result->linked],
        );
    }
}
