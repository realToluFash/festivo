<?php

declare(strict_types=1);

namespace App\Domain\Billing\Controller;

use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Repository\SubscriptionRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Who pays for the organisation's subscription: its Owners and Admins only, where the plan and status are any member's (sc-3927). */
final readonly class BillingAccountController
{
    public function __construct(
        private SubscriptionRepository $subscriptionRepository,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/billing-account', name: 'orgs_billing_account', methods: ['GET'])]
    #[InOrganisation(Permission::BillingRead)]
    public function show(string $organisationId): JsonResponse
    {
        $account = $this->subscriptionRepository->findCurrentOf(Uuid::fromString($organisationId))->getBillingAccount();

        return new JsonResponse([
            'contactEmail' => $account->getContactEmail(),
            'currency' => $account->getCurrency(),
            'countryCode' => $account->getCountryCode(),
            'taxId' => $account->getTaxId(),
            'creditBalance' => $account->getCreditBalance(),
        ]);
    }
}
