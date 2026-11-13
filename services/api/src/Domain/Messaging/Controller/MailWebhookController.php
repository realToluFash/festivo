<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\Webhook\MailWebhook;
use App\Http\Access\Policy\PublicAccess;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Throwable;

/** Postmark signs nothing: a report needs the basic-auth credentials and an address in the ranges, and an unset secret or unset ranges refuse every one. */
#[PublicAccess]
final readonly class MailWebhookController
{
    public function __construct(
        private MailWebhook $mailWebhook,
        #[SensitiveParameter]
        private string $secret,
        private string $allowedRanges,
    ) {
    }

    #[Route('/api/webhooks/mail', name: 'webhook_mail', methods: ['POST'])]
    public function report(Request $request): Response
    {
        if (!$this->admits($request)) {
            return new Response(null, Response::HTTP_UNAUTHORIZED, ['WWW-Authenticate' => 'Basic realm="mail webhook"']);
        }

        try {
            $report = Type\dict(Type\array_key(), Type\mixed())->coerce(Json\decode($request->getContent()));
            $this->mailWebhook->receive($report);
        } catch (Throwable) {
            return new Response(null, Response::HTTP_BAD_REQUEST);
        }

        return new Response(null, Response::HTTP_OK);
    }

    private function admits(Request $request): bool
    {
        $ranges = Vec\filter(Vec\map(Str\split($this->allowedRanges, ','), Str\trim(...)), static fn (string $range): bool => '' !== $range);
        $address = $request->getClientIp();

        return '' !== $this->secret
            && \hash_equals($this->secret, ($request->getUser() ?? '') . ':' . ($request->getPassword() ?? ''))
            && [] !== $ranges
            && null !== $address
            && IpUtils::checkIp($address, $ranges);
    }
}
