<?php

declare(strict_types=1);

namespace App\Realtime\Controller;

use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Realtime\SubscriberTokenIssuer;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Authenticated]
final readonly class RealtimeController
{
    public function __construct(
        private Security $security,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/realtime/subscriptions', name: 'realtime_subscribe', methods: ['POST'])]
    public function subscribe(): JsonResponse
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        $issued = $this->subscriberTokenIssuer->issueFor($user);

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }
}
