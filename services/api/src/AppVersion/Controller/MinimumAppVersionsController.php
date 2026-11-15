<?php

declare(strict_types=1);

namespace App\AppVersion\Controller;

use App\AppVersion\MinimumAppVersions;
use App\Http\Access\Policy\PublicAccess;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Signed out too: a build is asked to update before anybody signs in. */
#[PublicAccess]
final readonly class MinimumAppVersionsController
{
    public function __construct(
        private MinimumAppVersions $minimumAppVersions,
    ) {
    }

    #[Route('/api/app-versions/minimum', name: 'app_versions_minimum', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'ios' => $this->minimumAppVersions->ios,
            'android' => $this->minimumAppVersions->android,
        ]);
    }
}
