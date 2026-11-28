<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Controller;

use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Realtime\SubscriberTokenIssuer;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** The organisation's usage on its live channel, for its Owners and Admins only: Plan and billing's API refuses a Member, and so does this (sc-3929, sc-3934). */
final readonly class UsageSubscriptionController
{
    public function __construct(
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/usage/subscriptions', name: 'orgs_usage_subscribe', methods: ['POST'])]
    #[InOrganisation(Permission::BillingRead)]
    public function subscribe(string $organisationId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForOrganisationUsage(Uuid::fromString($organisationId));

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }
}
