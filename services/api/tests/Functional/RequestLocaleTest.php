<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

final class RequestLocaleTest extends ApiTestCase
{
    #[Test]
    #[DataProvider('headers')]
    public function itAnswersAnErrorInTheNegotiatedLanguage(string $header, string $contains): void
    {
        $this->client->catchExceptions(true);
        $this->client->request('GET', '/api/no-such-route', server: ['HTTP_ACCEPT_LANGUAGE' => $header]);

        $problem = \json_decode((string) $this->client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertStringContainsString($contains, $problem['title']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function headers(): iterable
    {
        yield 'english' => ['en', 'could not find'];
        yield 'spanish' => ['es', 'No hemos encontrado'];
        yield 'french' => ['fr', 'avons pas trouvé'];
        yield 'portuguese' => ['pt', 'Não encontrámos'];
        // A Brazilian reader gets Portuguese, not English.
        yield 'brazilian portuguese' => ['pt-BR,en;q=0.5', 'Não encontrámos'];
        // German is not supported; the next acceptable one wins.
        yield 'unsupported falls through' => ['de,fr;q=0.8', 'avons pas trouvé'];
        yield 'unsupported alone falls back' => ['de', 'could not find'];
        // A quality that is not a number used to cast to 0.0, which ranked the
        // language the client asked for below the one it offered as a fallback.
        yield 'malformed quality keeps its tag' => ['fr;q=abc,es;q=0.1', 'avons pas trouvé'];
    }

    /**
     * Somebody whose account is in French still needs to be able to produce an
     * English error to paste into a support ticket.
     */
    #[Test]
    public function anExplicitLocaleParameterOutranksTheHeader(): void
    {
        $this->client->catchExceptions(true);
        $this->client->request('GET', '/api/no-such-route?locale=es', server: ['HTTP_ACCEPT_LANGUAGE' => 'fr']);

        $problem = \json_decode((string) $this->client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        self::assertStringContainsString('No hemos encontrado', $problem['title']);
    }

    /**
     * A 404 is thrown by the router at priority 32. A locale listener below
     * that never runs for an unmatched route — which is precisely the error a
     * confused person is most likely to be reading.
     */
    #[Test]
    public function negotiationAppliesToErrorsThrownDuringRouting(): void
    {
        $this->client->catchExceptions(true);
        $this->client->request('GET', '/api/definitely-not-a-route', server: ['HTTP_ACCEPT_LANGUAGE' => 'fr']);

        $problem = \json_decode((string) $this->client->getResponse()->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('could not find', $problem['title']);
    }
}
