<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\PhoneSignIn\PhoneSignIns;
use App\Entity\PhoneSignIn;
use App\Entity\VerificationChallenge;
use App\Enum\PhoneCodeRoute;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The code step of a sign-in by phone code (sc-4235), whichever way in sent it: phone verification's countdown, resend and text-instead (sc-62, sc-750), by the step's handle, which travels in the body. */
#[PublicAccess]
final readonly class PhoneSignInController
{
    public function __construct(
        private PhoneSignIns $phoneSignIns,
    ) {
    }

    /** Polled while the code is on WhatsApp; never spends a try or sends a code itself. */
    #[Route('/api/auth/phone-sign-in/state', name: 'auth_phone_sign_in_state', methods: ['POST'])]
    public function state(Request $request): JsonResponse
    {
        return new JsonResponse($this->phoneSignIns->state($this->signIn($request)));
    }

    #[Route('/api/auth/phone-sign-in/resend', name: 'auth_phone_sign_in_resend', methods: ['POST'])]
    public function resend(Request $request): JsonResponse
    {
        $this->phoneSignIns->resend($this->signIn($request));

        return new JsonResponse(['cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    #[Route('/api/auth/phone-sign-in/text-instead', name: 'auth_phone_sign_in_text_instead', methods: ['POST'])]
    public function textInstead(Request $request): JsonResponse
    {
        $this->phoneSignIns->textInstead($this->signIn($request));

        return new JsonResponse(['route' => PhoneCodeRoute::SmsChosen->value]);
    }

    private function signIn(Request $request): PhoneSignIn
    {
        return $this->phoneSignIns->find(Input::body($request, Type\shape(['handle' => Type\string()]))['handle']);
    }
}
