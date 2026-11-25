<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Regions;
use App\Http\Access\Policy\Authenticated;
use Psl\Vec;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** What a new organisation starts with in each country, so a client shows it before anything is created (sc-30412). */
final readonly class CountriesController
{
    #[Route('/api/countries', name: 'countries_list', methods: ['GET'])]
    #[Authenticated]
    public function list(): JsonResponse
    {
        return new JsonResponse([
            'countries' => Vec\map(Regions::countries(), static function (string $code): array {
                $currency = Regions::currencyOf($code);

                return ['code' => $code, 'currency' => '' === $currency ? null : $currency];
            }),
        ]);
    }
}
