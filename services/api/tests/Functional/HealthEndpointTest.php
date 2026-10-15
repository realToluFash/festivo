<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\Test;

final class HealthEndpointTest extends ApiTestCase
{
    #[Test]
    public function itAnswersWithTheObjectItself(): void
    {
        $this->client->request('GET', '/api/health');

        $response = $this->client->getResponse();
        self::assertSame('application/json', $response->headers->get('Content-Type'));

        $body = \json_decode((string) $response->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertSame('soirely-api', $body['application']);
        self::assertSame('ok', $body['status']);
        self::assertArrayHasKey('postgres', $body['checks']);
        self::assertArrayHasKey('redis', $body['checks']);
    }

    /**
     * The envelope this endpoint used to answer in cost both clients a crash:
     * each read `status` and `checks` where the documented contract says they
     * are, got `undefined`, and every test passed because every test asserted
     * against the payload the client had invented. So the shape is held here,
     * where the server is, rather than only in two mocks.
     */
    #[Test]
    public function itDoesNotWrapTheObjectInAnything(): void
    {
        $this->client->request('GET', '/api/health');

        $body = \json_decode(
            (string) $this->client->getResponse()->getContent(),
            true,
            512,
            \JSON_THROW_ON_ERROR,
        );

        self::assertArrayNotHasKey('success', $body);
        self::assertArrayNotHasKey('data', $body);
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
