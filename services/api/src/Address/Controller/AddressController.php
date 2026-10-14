<?php

declare(strict_types=1);

namespace App\Address\Controller;

use App\Address\AddressLookup;
use App\Address\Exception\AddressNotFound;
use App\Address\Exception\ProviderUnavailable;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Throwable;

final class AddressController
{
    public function __construct(
        private readonly AddressLookup $lookup,
        private readonly RateLimiterFactoryInterface $addressLookupLimiter,
    ) {
    }

    #[Route('/api/addresses/suggest', name: 'address_suggest', methods: ['GET'])]
    public function suggest(Request $request): JsonResponse
    {
        $this->limit($request);

        $input = Input::query($request, Type\shape([
            'q' => Type\optional(Type\string()),
            'country' => Type\optional(Type\nullable(Type\string())),
        ]));

        try {
            $suggestions = $this->lookup->suggest($input['q'] ?? '', $input['country'] ?? null);
        } catch (ProviderUnavailable $e) {
            throw $this->unavailable($e);
        }

        return new JsonResponse([
            'success' => true,
            'data' => \array_map(static fn ($s) => $s->toArray(), $suggestions),
        ]);
    }

    #[Route('/api/addresses/{id}', name: 'address_resolve', methods: ['GET'], requirements: ['id' => '.+'])]
    public function resolve(string $id, Request $request): JsonResponse
    {
        $this->limit($request);

        try {
            $address = $this->lookup->resolve($id);
        } catch (AddressNotFound $e) {
            throw new ApiException(ErrorCode::NotFound, 'No address with that id.', [], $e);
        } catch (ProviderUnavailable $e) {
            throw $this->unavailable($e);
        }

        return new JsonResponse(['success' => true, 'data' => $address->toArray()]);
    }

    private function limit(Request $request): void
    {
        $limiter = $this->addressLookupLimiter->create($request->getClientIp() ?? 'anonymous');

        if (!$limiter->consume()->isAccepted()) {
            throw new ApiException(
                ErrorCode::TooManyRequests,
                'Too many address lookups. Please wait a moment.',
            );
        }
    }

    private function unavailable(Throwable $previous): ApiException
    {
        return new ApiException(
            ErrorCode::ServiceUnavailable,
            'Address lookup is unavailable. You can still type the address yourself.',
            [],
            $previous,
        );
    }
}
