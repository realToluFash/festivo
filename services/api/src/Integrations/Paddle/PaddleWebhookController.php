<?php

declare(strict_types=1);

namespace App\Integrations\Paddle;

use App\Http\Access\Policy\PublicAccess;
use Psl\Json;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Throwable;

/** A failed event answers 500 so Paddle retries it; one it gives up on reaches ops through the nightly reconciliation (sc-3933). */
#[PublicAccess]
final readonly class PaddleWebhookController
{
    private const int REPLAY_WINDOW_SECONDS = 300;

    public function __construct(
        private PaddleEvents $paddleEvents,
        private ClockInterface $clock,
        private LoggerInterface $logger,
        #[SensitiveParameter]
        private string $secret,
    ) {
    }

    #[Route('/api/webhooks/paddle', name: 'webhook_paddle', methods: ['POST'])]
    public function receive(Request $request): Response
    {
        $body = $request->getContent();

        if (!$this->signed($request->headers->get('Paddle-Signature') ?? '', $body)) {
            return new Response(null, Response::HTTP_UNAUTHORIZED);
        }

        try {
            $this->paddleEvents->receive(Json\decode($body));
        } catch (Throwable $exception) {
            $this->logger->error('A Paddle event failed to process; Paddle retries it.', ['exception' => $exception]);

            return new Response(null, Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return new Response(null, Response::HTTP_OK);
    }

    /** `ts=<unix>;h1=<hmac>`, the HMAC-SHA256 of `<ts>:<body>`; during a secret rotation Paddle sends one h1 per secret. */
    private function signed(string $header, string $body): bool
    {
        $timestamp = Regex\first_match($header, '/(?:^|;)ts=(\d+)(?:;|$)/')[1] ?? null;

        if ('' === $this->secret || null === $timestamp || Math\abs($this->clock->now()->getTimestamp() - (int) $timestamp) > self::REPLAY_WINDOW_SECONDS) {
            return false;
        }

        $expected = \hash_hmac('sha256', $timestamp . ':' . $body, $this->secret);
        $given = Vec\filter_nulls(Vec\map(
            Str\split($header, ';'),
            static fn (string $part): ?string => Str\starts_with($part, 'h1=') ? Str\strip_prefix($part, 'h1=') : null,
        ));

        foreach ($given as $signature) {
            if (\hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
    }
}
