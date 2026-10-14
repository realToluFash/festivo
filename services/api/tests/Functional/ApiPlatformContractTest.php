<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Enum\ErrorCode;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * What adopting API Platform is supposed to buy us, asserted rather than
 * assumed — these are the reasons the framework was chosen, so they are the
 * things worth failing a build over.
 */
final class ApiPlatformContractTest extends WebTestCase
{
    /**
     * The OpenAPI document is how both clients learn the shape of the API.
     * packages/api-client generates from it rather than hand-writing types, so
     * it stopping being served is a client-breaking change with no other signal.
     */
    #[Test]
    public function itServesAnOpenapiDocument(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/docs.json');

        self::assertResponseIsSuccessful();
        $doc = json_decode((string) $client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertArrayHasKey('openapi', $doc);
        self::assertStringStartsWith('3.', $doc['openapi']);
        self::assertSame('Soirely API', $doc['info']['title']);
        self::assertArrayHasKey('paths', $doc);
    }

    /**
     * Both our own errors and API Platform's own must be the same shape, or a
     * client needs one error reader per kind of endpoint and most of them never
     * get exercised.
     */
    #[Test]
    public function errorsAreRfc7807ProblemDocuments(): void
    {
        $client = static::createClient();
        $client->catchExceptions(true);
        $client->request('GET', '/api/no-such-route');

        self::assertResponseStatusCodeSame(404);
        self::assertStringContainsString(
            'application/problem+json',
            (string) $client->getResponse()->headers->get('Content-Type'),
        );

        $problem = json_decode((string) $client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        // The three RFC 7807 members we always send.
        self::assertArrayHasKey('type', $problem);
        self::assertArrayHasKey('title', $problem);
        self::assertArrayHasKey('status', $problem);
        self::assertSame($problem['status'], $client->getResponse()->getStatusCode());
    }

    /**
     * The type is the stable identifier a client branches on. If it stopped
     * being resolvable back to a known code, clients would be branching on
     * something we no longer recognise.
     */
    #[Test]
    public function aProblemTypeResolvesBackToAKnownErrorCode(): void
    {
        $client = static::createClient();
        $client->catchExceptions(true);
        $client->request('GET', '/api/no-such-route');

        $problem = json_decode((string) $client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertSame(ErrorCode::NotFound, ErrorCode::fromType($problem['type']));
    }

    /**
     * The title comes from the catalogue, so it is translatable. A raw key
     * rendering as the title is the failure mode this catches — it looks like
     * text and is not.
     */
    #[Test]
    public function theTitleIsASentenceNotATranslationKey(): void
    {
        $client = static::createClient();
        $client->catchExceptions(true);
        $client->request('GET', '/api/no-such-route');

        $problem = json_decode((string) $client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertStringNotContainsString('errors.', $problem['title']);
        self::assertNotSame(ErrorCode::NotFound->value, $problem['title']);
    }

    /**
     * JSON-LD is API Platform's default and a good one for a public,
     * self-describing API. This one has two clients that we also write, and.
     *
     * @context on every object is weight they would strip and ignore.
     */
    #[Test]
    public function theEntrypointDoesNotNegotiateFormatsWeDidNotChoose(): void
    {
        $client = static::createClient();
        $client->catchExceptions(true);
        $client->request('GET', '/api', server: ['HTTP_ACCEPT' => 'application/ld+json']);

        self::assertResponseStatusCodeSame(400);
    }
}
