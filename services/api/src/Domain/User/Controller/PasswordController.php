<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Password\PasswordChange;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Settings > Security, the password card: change it while signed in, knowing the current one. */
#[Authenticated]
final readonly class PasswordController
{
    public function __construct(
        private Security $security,
        private PasswordChange $passwordChange,
    ) {
    }

    /** `sessionId` names the caller's own session, which stays signed in; the client holds it, the token doesn't yet (sc-117). */
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

    private function user(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
        }

        return $user;
    }
}
