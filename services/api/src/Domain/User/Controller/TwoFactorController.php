<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Http\SecondFactorInput;
use App\Domain\User\TwoFactor\TwoFactorSettings;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasskeyStep;
use App\Http\Access\Policy\Authenticated;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Settings > Security, the two-factor card. */
#[Authenticated]
final readonly class TwoFactorController
{
    /** The signed-in steps a passkey answers; sign-in and a reset link ask through their own routes. */
    private const array SIGNED_IN_STEPS = [PasskeyStep::Proof, PasskeyStep::Add, PasskeyStep::AddApp, PasskeyStep::Remove, PasskeyStep::NewCodes, PasskeyStep::TurnOff];

    public function __construct(
        private Security $security,
        private TwoFactorSettings $twoFactorSettings,
        private CodeField $codeField,
        private SecondFactorInput $secondFactorInput,
    ) {
    }

    #[Route('/api/auth/two-factor', name: 'auth_two_factor_status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        return new JsonResponse($this->twoFactorSettings->status($this->user()));
    }

    /** With passkeys on, adding the app takes the current factor: `code` or `passkey`. */
    #[Route('/api/auth/two-factor/enrol', name: 'auth_two_factor_enrol', methods: ['POST'])]
    public function enrol(Request $request): JsonResponse
    {
        $body = '' === \trim($request->getContent()) ? [] : Input::body($request, Type\shape(SecondFactorInput::fields()));
        $answer = $this->secondFactorInput->eitherIfSent($body);

        return new JsonResponse($this->twoFactorSettings->enrol($this->user(), $answer));
    }

    #[Route('/api/auth/two-factor/activate', name: 'auth_two_factor_activate', methods: ['POST'])]
    public function activate(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\optional(Type\mixed())]));
        $code = $this->codeField->required($body, 'code', CodeField::FROM_APP);

        return new JsonResponse(['recoveryCodes' => $this->twoFactorSettings->activate(
            $this->user(),
            $code,
            $request->getLocale(),
            $request->headers->get('User-Agent'),
        )]);
    }

    /** The options a sheet opens with: to make a passkey (taking the current factor when on), or to use one. */
    #[Route('/api/auth/two-factor/passkeys/options', name: 'auth_two_factor_passkey_options', methods: ['POST'])]
    public function passkeyOptions(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'make' => Type\optional(Type\bool()),
            'step' => Type\optional(Type\backed_enum(PasskeyStep::class)),
            ...SecondFactorInput::fields(),
        ]));

        if (true === ($body['make'] ?? false)) {
            $answer = $this->secondFactorInput->eitherIfSent($body);

            return new JsonResponse($this->twoFactorSettings->passkeyCreationOptions($this->user(), $answer));
        }

        $step = $body['step'] ?? null;

        if (!\in_array($step, self::SIGNED_IN_STEPS, true)) {
            throw new ApiException(ErrorCode::BadRequest, 'passkey.step');
        }

        return new JsonResponse($this->twoFactorSettings->passkeyRequestOptions($this->user(), $step));
    }

    /** A new passkey: it turns two-factor on with recovery codes, or joins the factors already on. */
    #[Route('/api/auth/two-factor/passkeys', name: 'auth_two_factor_passkey_add', methods: ['POST'])]
    public function addPasskey(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['passkey' => Type\dict(Type\string(), Type\mixed())]));

        return new JsonResponse(['recoveryCodes' => $this->twoFactorSettings->addPasskey(
            $this->user(),
            $body['passkey'],
            $request->getLocale(),
            $request->headers->get('User-Agent'),
        )]);
    }

    /** One factor of several: `factor` is `app` or a passkey's id. */
    #[Route('/api/auth/two-factor/remove', name: 'auth_two_factor_remove', methods: ['POST'])]
    public function remove(Request $request): Response
    {
        $body = Input::body($request, Type\shape(['factor' => Type\string(), ...SecondFactorInput::fields()]));
        $this->twoFactorSettings->remove($this->user(), $body['factor'], $this->secondFactorInput->either($body), $request->headers->get('User-Agent'));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/auth/two-factor/recovery-codes', name: 'auth_two_factor_recovery_codes', methods: ['POST'])]
    public function newRecoveryCodes(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(SecondFactorInput::fields()));

        return new JsonResponse(['recoveryCodes' => $this->twoFactorSettings->newRecoveryCodes($this->user(), $this->secondFactorInput->either($body))]);
    }

    #[Route('/api/auth/two-factor/disable', name: 'auth_two_factor_disable', methods: ['POST'])]
    public function disable(Request $request): Response
    {
        $body = Input::body($request, Type\shape(SecondFactorInput::fields()));
        $this->twoFactorSettings->turnOff($this->user(), $this->secondFactorInput->either($body));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        return $user;
    }
}
