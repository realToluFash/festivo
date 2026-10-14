<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\Test;

final class HealthEndpointTest extends ApiTestCase
{
    #[Test]
    public function itAnswersInTheEnvelope(): void
    {
        $this->client->request('GET', '/api/health');

        $response = $this->client->getResponse();
        self::assertSame('application/json', $response->headers->get('Content-Type'));

        $body = \json_decode((string) $response->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('success', $body);
        self::assertArrayHasKey('data', $body);
        self::assertSame('soirely-api', $body['data']['application']);
        self::assertArrayHasKey('postgres', $body['data']['checks']);
        self::assertArrayHasKey('redis', $body['data']['checks']);
    }

    /**
     * Symfony's default for an unmatched route is an HTML page, which a mobile
     * client parses as nothing at all — so the one case a client most needs to
     * understand would be the one it cannot read.
     */
    #[Test]
    public function anUnknownApiRouteAnswersInJsonNotHtml(): void
    {
        $this->client->catchExceptions(true);
        $this->client->request('GET', '/api/no-such-route');

        $response = $this->client->getResponse();
        self::assertSame(404, $response->getStatusCode());
        self::assertStringContainsString(
            'application/problem+json',
            (string) $response->headers->get('Content-Type'),
        );

        $body = \json_decode((string) $response->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        self::assertSame('https://soirely.com/errors/not_found', $body['type']);
        self::assertSame(404, $body['status']);
        self::assertArrayHasKey('correlationId', $body);
    }

    #[Test]
    public function everyResponseCarriesACorrelationId(): void
    {
        $this->client->request('GET', '/api/health');

        $id = $this->client->getResponse()->headers->get('X-Correlation-Id');
        self::assertNotNull($id);
        self::assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $id);
    }

    #[Test]
    public function itKeepsACorrelationIdTheCallerSupplied(): void
    {
        $supplied = '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f';
        $this->client->request('GET', '/api/health', server: ['HTTP_X_CORRELATION_ID' => $supplied]);

        self::assertSame($supplied, $this->client->getResponse()->headers->get('X-Correlation-Id'));
    }

    /**
     * An id from outside is only trusted if it looks like one. Echoing arbitrary
     * text back into every log line of the request is log injection.
     */
    #[Test]
    public function itReplacesACorrelationIdThatIsNotAUuid(): void
    {
        $junk = "not-a-uuid\nFAKE LOG LINE";
        $this->client->request('GET', '/api/health', server: ['HTTP_X_CORRELATION_ID' => $junk]);

        $id = $this->client->getResponse()->headers->get('X-Correlation-Id');
        self::assertNotSame($junk, $id);
        self::assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', (string) $id);
    }
}
