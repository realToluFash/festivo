<?php

declare(strict_types=1);

namespace App\Integrations\SingleSignOn;

use App\Domain\Organisation\Interfaces\ProviderDocumentsInterface;
use Psl\Str\Byte;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Symfony\Component\HttpClient\NoPrivateNetworkHttpClient;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** An address an Owner typed is fetched only on the public internet, so it can never reach the stack's own network. */
final readonly class HttpProviderDocuments implements ProviderDocumentsInterface
{
    private const int MAX_BYTES = 1_000_000;

    private HttpClientInterface $http;

    public function __construct(
        HttpClientInterface $http,
        private LoggerInterface $logger,
    ) {
        $this->http = new NoPrivateNetworkHttpClient($http);
    }

    public function fetch(string $url): ?string
    {
        try {
            $response = $this->http->request('GET', $url, ['timeout' => 10, 'max_redirects' => 3]);

            if (200 !== $response->getStatusCode()) {
                return null;
            }

            $body = $response->getContent();
        } catch (ExceptionInterface $exception) {
            $this->logger->info('An identity provider document could not be read.', ['url' => $url, 'exception' => $exception]);

            return null;
        }

        return Byte\length($body) > self::MAX_BYTES ? null : $body;
    }

    public function redeem(string $endpoint, string $clientId, #[SensitiveParameter] string $clientSecret, #[SensitiveParameter] array $fields): ?string
    {
        try {
            $body = $this->http->request('POST', $endpoint, [
                'timeout' => 10,
                'max_redirects' => 0,
                'auth_basic' => [\urlencode($clientId), \urlencode($clientSecret)],
                'body' => $fields,
            ])->getContent(false);
        } catch (ExceptionInterface $exception) {
            $this->logger->info('An identity provider token endpoint did not answer.', ['url' => $endpoint, 'exception' => $exception::class]);

            return null;
        }

        return Byte\length($body) > self::MAX_BYTES ? null : $body;
    }
}
