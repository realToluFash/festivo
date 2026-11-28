<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\Interfaces\SmsRequestSignatureInterface;
use App\Domain\Messaging\Sms\SmsKeywordAnswerer;
use App\Domain\Messaging\Webhook\SmsStatusWebhook;
use App\Http\Access\Policy\PublicAccess;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** What Twilio posts to Soirely (sc-3946): anything its signature does not sign is refused with 403 and changes nothing. */
#[PublicAccess]
final readonly class SmsWebhookController
{
    public function __construct(
        private SmsRequestSignatureInterface $smsRequestSignature,
        private SmsKeywordAnswerer $smsKeywordAnswerer,
        private SmsStatusWebhook $smsStatusWebhook,
    ) {
    }

    /** Twilio's status callback for a text Soirely sent; it wants a 2xx whatever the report changed. */
    #[Route('/api/webhooks/sms/status', name: 'webhook_sms_status', methods: ['POST'])]
    public function status(Request $request): Response
    {
        if (!$this->smsRequestSignature->signs($request)) {
            return new Response(null, Response::HTTP_FORBIDDEN);
        }

        $code = $request->request->getString('ErrorCode');
        $this->smsStatusWebhook->receive($request->request->getString('MessageSid'), $request->request->getString('MessageStatus'), '' === $code ? null : $code);

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** The reply goes back as TwiML, so one text in is answered at most once. */
    #[Route('/api/webhooks/sms/inbound', name: 'webhook_sms_inbound', methods: ['POST'])]
    public function inbound(Request $request): Response
    {
        if (!$this->smsRequestSignature->signs($request)) {
            return new Response(null, Response::HTTP_FORBIDDEN);
        }

        $from = $request->request->getString('From');
        $reply = '' === $from ? null : $this->smsKeywordAnswerer->answer($from, $request->request->getString('Body'));
        $message = null === $reply ? '' : '<Message>' . \htmlspecialchars($reply, \ENT_XML1) . '</Message>';

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response>' . $message . '</Response>', Response::HTTP_OK, ['Content-Type' => 'text/xml; charset=UTF-8']);
    }
}
