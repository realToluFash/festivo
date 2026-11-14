<?php

declare(strict_types=1);

namespace App\Integrations\Meta;

use App\Domain\User\Interfaces\WhatsAppSenderInterface;
use Psl\Str;
use Psl\Type;
use RuntimeException;
use SensitiveParameter;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Meta's WhatsApp Cloud API: an authentication template with its copy-code button. In development, the mock. */
final readonly class WhatsAppCloudSender implements WhatsAppSenderInterface
{
    /** Meta's language codes for the template; Portuguese is Portugal's, as the app's is. */
    private const array LANGUAGES = ['en' => 'en', 'es' => 'es', 'fr' => 'fr', 'pt' => 'pt_PT'];

    public function __construct(
        private HttpClientInterface $http,
        private string $apiBase,
        private string $phoneNumberId,
        #[SensitiveParameter]
        private string $accessToken,
        private string $template,
    ) {
    }

    public function sendCode(string $to, #[SensitiveParameter] string $code, string $locale): string
    {
        $response = $this->http->request(
            'POST',
            Str\trim_right($this->apiBase, '/') . '/' . \rawurlencode($this->phoneNumberId) . '/messages',
            [
                'auth_bearer' => $this->accessToken,
                'json' => [
                    'messaging_product' => 'whatsapp',
                    'to' => $to,
                    'type' => 'template',
                    'template' => [
                        'name' => $this->template,
                        'language' => ['code' => self::LANGUAGES[$locale] ?? 'en'],
                        'components' => [
                            ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $code]]],
                            ['type' => 'button', 'sub_type' => 'url', 'index' => '0', 'parameters' => [['type' => 'text', 'text' => $code]]],
                        ],
                    ],
                ],
                'timeout' => 10,
            ],
        );

        if ($response->getStatusCode() >= 300) {
            throw new RuntimeException('WhatsApp refused the message with ' . $response->getStatusCode() . '.');
        }

        $body = Type\shape(['messages' => Type\vec(Type\shape(['id' => Type\string()], true))], true)->coerce($response->toArray());

        return $body['messages'][0]['id'] ?? throw new RuntimeException('WhatsApp answered with no message id.');
    }
}
