<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\TwoFactor\Recovery\RecoveryDecisions;
use App\Domain\User\TwoFactor\Recovery\RecoveryView;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** The requests to get back in that this owner or admin may answer, across their organisations (sc-509). */
#[Authenticated]
final readonly class RecoveryApprovalController
{
    public function __construct(
        private Security $security,
        private RecoveryDecisions $recoveryDecisions,
        private RecoveryView $recoveryView,
        private EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/auth/recovery-requests', name: 'auth_recovery_requests', methods: ['GET'])]
    public function waiting(Request $request): JsonResponse
    {
        $approver = $this->user();

        return new JsonResponse(['requests' => Vec\map(
            $this->recoveryDecisions->waitingFor($approver),
            fn (TwoFactorRecovery $recovery): array => $this->recoveryView->request($recovery, $approver, $request->getLocale()),
        )]);
    }

    #[Route('/api/auth/recovery-requests/{id}/approve', name: 'auth_recovery_request_approve', methods: ['POST'])]
    public function approve(string $id): JsonResponse
    {
        $this->recoveryDecisions->approve($this->user(), $id);

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/auth/recovery-requests/{id}/turn-down', name: 'auth_recovery_request_turn_down', methods: ['POST'])]
    public function turnDown(string $id): JsonResponse
    {
        $this->recoveryDecisions->turnDown($this->user(), $id);

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /** "Not now" on Set up two-factor again: the prompt stops, and Security still offers it. */
    #[Route('/api/auth/two-factor/setup-prompt', name: 'auth_two_factor_setup_prompt_dismiss', methods: ['DELETE'])]
    public function dismissPrompt(): JsonResponse
    {
        $this->user()->setTwoFactorSetupPrompt(false);
        $this->entityManager->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
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
