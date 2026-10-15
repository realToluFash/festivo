<?php

declare(strict_types=1);

namespace App\Health\Controller;

use App\Health\HealthChecker;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class HealthController extends AbstractController
{
    public function __construct(
        private readonly HealthChecker $healthChecker,
        private readonly string $appEnv,
    ) {
    }

    #[Route('/api/health', name: 'health', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        $result = $this->healthChecker->check();

        $status = 'ok' === $result['status']
            ? JsonResponse::HTTP_OK
            : JsonResponse::HTTP_SERVICE_UNAVAILABLE;

        // No envelope. Every other response in this API is the object itself —
        // the auth endpoints, API Platform's resources, which cannot envelope
        // at all — and a failure is a problem document. A `success` field
        // beside a status code is a second copy of the same fact, and the two
        // clients read the object they were documented to read.
        return new JsonResponse([
            'application' => 'soirely-api',
            'environment' => $this->appEnv,
            'status' => $result['status'],
            'checks' => $result['checks'],
        ], $status);
    }
}
