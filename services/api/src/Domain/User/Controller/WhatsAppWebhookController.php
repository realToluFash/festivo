<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Verification\PhoneCodeDispatch;
use App\Http\Access\Policy\PublicAccess;
use Psl\Json;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Meta's delivery reports for phone codes (sc-750): signed with the app secret, or ignored. */
#[PublicAccess]
final readonly class WhatsAppWebhookController
{
    public function __construct(
        private PhoneCodeDispatch $phoneCodeDispatch,
        #[SensitiveParameter]
        private string $verifyToken,
        #[SensitiveParameter]
        private string $appSecret,
    ) {
    }

    /** Meta's subscription check: echo the challenge for our own verify token. */
    #[Route('/api/webhooks/whatsapp', name: 'webhook_whatsapp_verify', methods: ['GET'])]
    public function verify(Request $request): Response
    {
        $ours = 'subscribe' === $request->query->get('hub_mode') && '' !== $this->verifyToken
            && \hash_equals($this->verifyToken, (string) $request->query->get('hub_verify_token'));

        return $ours
            ? new Response((string) $request->query->get('hub_challenge'), Response::HTTP_OK, ['Content-Type' => 'text/plain'])
            : new Response(null, Response::HTTP_FORBIDDEN);
    }

    #[Route('/api/webhooks/whatsapp', name: 'webhook_whatsapp', methods: ['POST'])]
    public function report(Request $request): Response
    {
        $raw = $request->getContent();
        $signature = 'sha256=' . \hash_hmac('sha256', $raw, $this->appSecret);

        if ('' === $this->appSecret || !\hash_equals($signature, (string) $request->headers->get('X-Hub-Signature-256'))) {
            return new Response(null, Response::HTTP_FORBIDDEN);
        }

        $statuses = Type\shape(['entry' => Type\vec(Type\shape(['changes' => Type\vec(Type\shape(['value' => Type\shape([
            'statuses' => Type\optional(Type\vec(Type\shape(['id' => Type\string(), 'status' => Type\string()], true))),
        ], true)], true))], true))], true);

        foreach ($statuses->coerce(Json\decode($raw))['entry'] as $entry) {
            foreach ($entry['changes'] as $change) {
                foreach ($change['value']['statuses'] ?? [] as $status) {
                    $this->phoneCodeDispatch->reported($status['id'], $status['status']);
                }
            }
        }

        return new Response(null, Response::HTTP_OK);
    }
}
