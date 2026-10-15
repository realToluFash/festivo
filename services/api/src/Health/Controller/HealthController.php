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

        return new JsonResponse([
            'application' => 'soirely-api',
            'environment' => $this->appEnv,
            'status' => $result['status'],
            'checks' => $result['checks'],
        ], $status);
    }
}
