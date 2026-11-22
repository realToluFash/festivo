<?php

declare(strict_types=1);

namespace App\Integrations\Meta;

use App\Domain\User\Interfaces\WhatsAppSenderInterface;
use App\Domain\User\Verification\WhatsAppPaymentRefusal;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use RuntimeException;
use SensitiveParameter;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Throwable;

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
        private WhatsAppPaymentRefusal $paymentRefusal,
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
            $this->paymentRefusal->noticeAmong(null, self::errorsIn($response->getContent(false)));

            throw new RuntimeException('WhatsApp refused the message with ' . $response->getStatusCode() . '.');
        }

        $body = Type\shape(['messages' => Type\vec(Type\shape(['id' => Type\string()], true))], true)->coerce($response->toArray());

        return $body['messages'][0]['id'] ?? throw new RuntimeException('WhatsApp answered with no message id.');
    }

    /** @return list<array{code?: int, title?: string, message?: string, ...}> Meta's error object, or nothing when the body is not one */
    private static function errorsIn(string $body): array
    {
        $refusal = Type\shape(['error' => Type\shape([
            'code' => Type\optional(Type\int()),
            'title' => Type\optional(Type\string()),
            'message' => Type\optional(Type\string()),
        ], true)], true);

        try {
            return [$refusal->coerce(Json\decode($body))['error']];
        } catch (Throwable) {
            return [];
        }
    }
}
