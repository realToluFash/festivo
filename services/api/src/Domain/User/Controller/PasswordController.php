<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Password\PasswordChange;
use App\Domain\User\Password\PasswordSetting;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
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
use Symfony\Component\Uid\Uuid;

/** Settings > Security, the password card: change it knowing the current one, or add one to a Google or Apple account. */
#[Authenticated]
final readonly class PasswordController
{
    public function __construct(
        private Security $security,
        private PasswordChange $passwordChange,
        private PasswordSetting $passwordSetting,
        private CodeField $codeField,
    ) {
    }

    /** `sessionId` names the caller's own session, which stays signed in. */
    #[Route('/api/auth/password', name: 'auth_password_change', methods: ['PATCH'])]
    public function change(Request $request): JsonResponse
    {
        $user = $this->user();
        $body = Input::body($request, Type\shape([
            'currentPassword' => Type\string(),
            'newPassword' => Type\string(),
            'sessionId' => Type\optional(Type\nullable(Type\string())),
        ]));

        $session = $body['sessionId'] ?? null;
        $signedOut = $this->passwordChange->change(
            $user,
            $body['currentPassword'],
            $body['newPassword'],
            null !== $session && Uuid::isValid($session) ? Uuid::fromString($session) : null,
            $request,
        );

        return new JsonResponse(['signedOut' => $signedOut]);
    }

    /** The first step of adding a password: a code to the primary address, under the resend cooldown. */
    #[Route('/api/auth/password/set/start', name: 'auth_password_set_start', methods: ['POST'])]
    public function startSetting(Request $request): JsonResponse
    {
        $wait = $this->passwordSetting->sendCode($this->user(), $request->getLocale());

        if (null !== $wait) {
            throw new ApiException(ErrorCode::TooManyAttempts, 'code.wait', [], null, ['Retry-After' => (string) $wait]);
        }

        return new JsonResponse(['cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    #[Route('/api/auth/password/set/code', name: 'auth_password_set_code', methods: ['POST'])]
    /** Answers the one-time `stepUp` token: only the client that entered the code can then set the password. */
    public function passCode(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\optional(Type\mixed())]));

        return new JsonResponse(['stepUp' => $this->passwordSetting->passCode($this->user(), $this->codeField->required($body, 'code', CodeField::FROM_EMAIL))]);
    }

    #[Route('/api/auth/password/set', name: 'auth_password_set', methods: ['POST'])]
    public function set(Request $request): Response
    {
        $body = Input::body($request, Type\shape(['newPassword' => Type\string(), 'stepUp' => Type\string()]));
        $this->passwordSetting->set($this->user(), $body['newPassword'], $body['stepUp'], $request);

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
