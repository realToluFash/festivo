<?php

declare(strict_types=1);

namespace App\Domain\Billing\Controller;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Interfaces\PaymentProviderInterface;
use App\Enum\BillingInterval;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\Plan;
use App\Enum\PlanSales;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\SubscriptionRepository;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** The provider's hosted pages (sc-3933): the price is the catalogue's, never the browser's, and only the provider's webhook changes the subscription. */
final readonly class CheckoutController
{
    public function __construct(
        private SubscriptionRepository $subscriptionRepository,
        private Catalogue $catalogue,
        private PaymentProviderInterface $paymentProvider,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/billing/checkout', name: 'orgs_billing_checkout', methods: ['POST'])]
    #[InOrganisation(Permission::BillingManage)]
    public function checkout(Request $request, string $organisationId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'plan' => Type\backed_enum(Plan::class),
            'interval' => Type\backed_enum(BillingInterval::class),
        ]));
        $subscription = $this->subscriptionRepository->findCurrentOf(Uuid::fromString($organisationId));
        $terms = $this->catalogue->inForce()->plan($body['plan']);
        $price = $terms->price($subscription->getBillingAccount()->getCurrency());

        if (PlanSales::SelfServe !== $terms->sales || null === $price) {
            throw new ApiException(ErrorCode::Conflict);
        }

        return new JsonResponse(
            ['checkout' => ['transactionId' => $this->provider(fn (): string => $this->paymentProvider->checkout($subscription, $body['plan'], $price, $body['interval']))]],
            Response::HTTP_CREATED,
        );
    }

    #[Route('/api/orgs/{organisationId}/billing/payment-method', name: 'orgs_billing_payment_method', methods: ['POST'])]
    #[InOrganisation(Permission::BillingManage)]
    public function paymentMethod(string $organisationId): JsonResponse
    {
        $subscription = $this->subscriptionRepository->findCurrentOf(Uuid::fromString($organisationId));

        if (null === $subscription->getExternalRef()) {
            throw new ApiException(ErrorCode::Conflict);
        }

        return new JsonResponse(
            ['checkout' => ['transactionId' => $this->provider(fn (): string => $this->paymentProvider->paymentMethodUpdate($subscription))]],
            Response::HTTP_CREATED,
        );
    }

    /** @param callable(): string $call */
    private function provider(callable $call): string
    {
        try {
            return $call();
        } catch (Throwable $exception) {
            throw new ApiException(ErrorCode::ServiceUnavailable, previous: $exception);
        }
    }
}
