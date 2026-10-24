<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\TwoFactor\TwoFactorSettings;
use App\Entity\User;
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

/** Settings > Security, the two-factor card. */
#[Authenticated]
final readonly class TwoFactorController
{
    public function __construct(
        private Security $security,
        private TwoFactorSettings $twoFactorSettings,
        private CodeField $codeField,
    ) {
    }

    #[Route('/api/auth/two-factor', name: 'auth_two_factor_status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        return new JsonResponse($this->twoFactorSettings->status($this->user()));
    }

    #[Route('/api/auth/two-factor/enrol', name: 'auth_two_factor_enrol', methods: ['POST'])]
    public function enrol(): JsonResponse
    {
        return new JsonResponse($this->twoFactorSettings->enrol($this->user()));
    }

    #[Route('/api/auth/two-factor/activate', name: 'auth_two_factor_activate', methods: ['POST'])]
    public function activate(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\optional(Type\mixed())]));
        $code = $this->codeField->required($body, 'code', CodeField::FROM_APP);

        return new JsonResponse(['recoveryCodes' => $this->twoFactorSettings->activate($this->user(), $code, $request->getLocale())]);
    }

    #[Route('/api/auth/two-factor/recovery-codes', name: 'auth_two_factor_recovery_codes', methods: ['POST'])]
    public function newRecoveryCodes(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\optional(Type\mixed())]));
        $code = $this->codeField->required($body, 'code', CodeField::FROM_APP_OR_RECOVERY);

        return new JsonResponse(['recoveryCodes' => $this->twoFactorSettings->newRecoveryCodes($this->user(), $code)]);
    }

    #[Route('/api/auth/two-factor/disable', name: 'auth_two_factor_disable', methods: ['POST'])]
    public function disable(Request $request): Response
    {
        $body = Input::body($request, Type\shape(['code' => Type\optional(Type\mixed())]));
        $this->twoFactorSettings->turnOff($this->user(), $this->codeField->required($body, 'code', CodeField::FROM_APP_OR_RECOVERY));

        return new Response(null, Response::HTTP_NO_CONTENT);
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
