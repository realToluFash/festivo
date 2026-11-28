<?php

declare(strict_types=1);

namespace App\Integrations\Twilio;

use App\Domain\Messaging\Interfaces\SmsRequestSignatureInterface;
use Psl\Dict;
use Psl\Str;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;

/** Twilio's request signature: HMAC-SHA1, keyed with the account's token, over the URL it called and then each posted field's name and value in name order. */
final readonly class TwilioSignature implements SmsRequestSignatureInterface
{
    public function __construct(
        #[SensitiveParameter]
        #[Autowire(env: 'SMS_AUTH_TOKEN')]
        private string $authToken,
        #[Autowire(env: 'DEFAULT_URI')]
        private string $apiOrigin,
    ) {
    }

    /** The URL is built from our public origin, since a proxy changes the one the request arrives under. */
    public function signs(Request $request): bool
    {
        $given = $request->headers->get('X-Twilio-Signature') ?? '';

        return '' !== $this->authToken && '' !== $given
            && \hash_equals($this->of($this->url($request->getRequestUri()), $request->request->all()), $given);
    }

    /** @param array<array-key, mixed> $fields */
    public function of(string $url, array $fields): string
    {
        $signed = $url;

        foreach (Dict\sort_by_key($fields) as $name => $value) {
            $signed .= $name . (\is_scalar($value) ? (string) $value : '');
        }

        return \base64_encode(\hash_hmac('sha1', $signed, $this->authToken, true));
    }

    public function url(string $path): string
    {
        return Str\trim_right($this->apiOrigin, '/') . $path;
    }
}
