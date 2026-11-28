<?php

declare(strict_types=1);

namespace App\Integrations\Twilio;

use App\Domain\User\Interfaces\TextMessageSenderInterface;
use Psl\Str;
use RuntimeException;
use SensitiveParameter;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Twilio's Messages API. In development the same request reaches the SMS mock, which answers as Twilio does. */
final readonly class TwilioTextMessageSender implements TextMessageSenderInterface
{
    public function __construct(
        private HttpClientInterface $http,
        private string $apiBase,
        private string $accountSid,
        #[SensitiveParameter]
        private string $authToken,
        private string $from,
    ) {
    }

    public function send(string $to, string $body): void
    {
        $response = $this->http->request(
            'POST',
            Str\trim_right($this->apiBase, '/') . '/2010-04-01/Accounts/' . \rawurlencode($this->accountSid) . '/Messages.json',
            [
                'auth_basic' => [$this->accountSid, $this->authToken],
                'body' => ['To' => $to, 'From' => $this->from, 'Body' => $body],
                'timeout' => 10,
            ],
        );

        if ($response->getStatusCode() >= 300) {
            throw new RuntimeException('The SMS provider refused the message with ' . $response->getStatusCode() . '.');
        }
    }
}
