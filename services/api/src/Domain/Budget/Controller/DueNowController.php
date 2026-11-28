<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Reminder\DueNow;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Due now (sc-1331): a reminder's link reads its payments; Paid, Paid a different amount and Undo are sc-88's own commands on each payment's event. */
final readonly class DueNowController
{
    public function __construct(
        private DueNow $dueNow,
        private Security $security,
    ) {
    }

    /** A reminder that does not exist and one whose events the reader no longer holds the budget on are the same 404. */
    #[Route('/api/payment-reminders/{sendId}', name: 'budget_due_now', methods: ['GET'])]
    #[Authenticated]
    public function show(string $sendId): JsonResponse
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        return new JsonResponse($this->dueNow->of($sendId, $user) ?? throw ApiException::notFound('access.not_found'));
    }
}
