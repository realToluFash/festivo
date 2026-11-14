<?php

declare(strict_types=1);

namespace App\Integrations\Dns;

use App\Domain\Organisation\Interfaces\TxtRecordLookupInterface;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface as HttpException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** DNS over HTTPS, JSON form. A failed lookup reads as nothing published, so the claim waits for the next check. */
final readonly class DnsOverHttpsTxtLookup implements TxtRecordLookupInterface
{
    private const int TXT = 16;

    public function __construct(
        private HttpClientInterface $http,
        private LoggerInterface $logger,
        private string $endpoint,
    ) {
    }

    public function lookUp(string $name): array
    {
        try {
            $body = $this->http->request('GET', $this->endpoint, [
                'query' => ['name' => $name, 'type' => 'TXT'],
                'headers' => ['Accept' => 'application/dns-json'],
                'timeout' => 5,
            ])->getContent();
            $answer = Type\shape([
                'Status' => Type\int(),
                'Answer' => Type\optional(Type\vec(Type\shape(['type' => Type\int(), 'data' => Type\string()], true))),
            ], true)->coerce(Json\decode($body));
        } catch (HttpException|Json\Exception\DecodeException|Type\Exception\CoercionException $e) {
            $this->logger->warning('DNS lookup failed; read as no record published', ['exception' => $e::class]);

            return [];
        }

        return Vec\map(
            Vec\filter($answer['Answer'] ?? [], static fn (array $record): bool => self::TXT === $record['type']),
            static fn (array $record): string => self::unquoted($record['data']),
        );
    }

    /** A value longer than 255 bytes arrives as several quoted strings, `"abc" "def"`, which are one value joined. */
    private static function unquoted(string $data): string
    {
        $parts = Regex\every_match($data, '/"((?:[^"\\\\]|\\\\.)*)"/') ?? [];

        return [] === $parts ? $data : Str\join(Vec\map($parts, static fn (array $part): string => $part[1]), '');
    }
}
