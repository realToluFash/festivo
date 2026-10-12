<?php

declare(strict_types=1);

namespace App\Controller;

use App\Address\AddressLookup;
use App\Address\AddressNotFound;
use App\Address\ProviderUnavailable;
use App\Http\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;
use Throwable;

/**
 * Address autocomplete, proxied.
 *
 * Proxied rather than called from the client because the provider key must
 * never reach a browser or a phone — and because rate limiting and caching
 * belong on one side of that boundary, not in two client implementations.
 */
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

        // Declared rather than cast. The previous build's version of this read
        // `$request->query->get('country')` straight into a `string ...$parts`
        // cache-key builder, PHP coerced the null, and every countryless
        // suggestion became a 500 that never mentioned the country.
        $input = Input::query($request, Type\shape([
            'q' => Type\optional(Type\string()),
            'country' => Type\optional(Type\nullable(Type\string())),
        ]));

        try {
            // A missing `q` is shorter than the minimum, so it short-circuits
            // the same way "lo" does rather than being an error. Asking for
            // suggestions before typing is not a client mistake.
            $suggestions = $this->lookup->suggest($input['q'] ?? '', $input['country'] ?? null);
        } catch (ProviderUnavailable $e) {
            throw $this->unavailable($e);
        }

        return new JsonResponse([
            'success' => true,
            'data' => array_map(static fn ($s) => $s->toArray(), $suggestions),
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

    /**
     * A provider outage is a 503, and a specific one.
     *
     * The caller must be able to tell "we cannot ask" from "no such address",
     * because autocomplete being down is never a reason to stop somebody
     * saving a venue they typed out themselves.
     */
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
