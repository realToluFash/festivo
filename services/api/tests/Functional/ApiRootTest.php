<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class ApiRootTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @return iterable<string, array{string|null}> */
    public static function acceptHeaders(): iterable
    {
        yield 'none' => [null];
        yield 'anything' => ['*/*'];
        yield 'html' => ['text/html'];
        yield 'a browser' => ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'];
        yield 'json' => ['application/json'];
        yield 'json-ld' => ['application/ld+json'];
    }

    #[Test]
    #[DataProvider('acceptHeaders')]
    public function theRootIsTheSame404AsAnUnknownPath(?string $accept): void
    {
        $server = null === $accept ? [] : ['HTTP_ACCEPT' => $accept];
        $unknown = $this->problem('GET', '/api/no-such-thing', $server);

        self::assertSame($unknown, $this->problem('GET', '/api', $server));
    }

    #[Test]
    public function aSignedInAccountGetsThe404Too(): void
    {
        $user = self::service(UserRegistrar::class)->register('member@example.com', 'Member', 'a decent passphrase')->user;
        self::onboard($user);
        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );

        self::assertSame($this->problem('GET', '/api/no-such-thing'), $this->problem('GET', '/api'));
    }

    #[Test]
    public function theEntrypointsFormatPathsAreThe404Too(): void
    {
        $unknown = $this->problem('GET', '/api/no-such-thing');

        foreach (['/api/index.json', '/api/index.jsonld', '/api/index.html'] as $path) {
            self::assertSame($unknown, $this->problem('GET', $path), $path);
        }
    }

    #[Test]
    public function everyOtherMethodIsThe404Too(): void
    {
        $unknown = $this->problem('GET', '/api/no-such-thing');

        foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            self::assertSame($unknown, $this->problem($method, '/api'), $method);
        }
    }

    #[Test]
    public function headIsA404WithNoBody(): void
    {
        $this->client->request('HEAD', '/api');

        self::assertResponseStatusCodeSame(404);
        self::assertSame('', (string) $this->client->getResponse()->getContent());
    }

    #[Test]
    public function theTitleIsInTheRequestsLanguage(): void
    {
        $titles = [];
        foreach (['en', 'es', 'fr', 'pt'] as $language) {
            $server = ['HTTP_ACCEPT_LANGUAGE' => $language];
            $root = $this->problem('GET', '/api', $server);

            self::assertSame($this->problem('GET', '/api/no-such-thing', $server), $root, $language);
            $titles[] = $root[1];
        }

        self::assertCount(4, Vec\unique($titles));
    }

    /** @return iterable<string, array{string, array<string, string>}> */
    public static function documentRequests(): iterable
    {
        yield 'docs.json' => ['/api/docs.json', []];
        yield 'docs.jsonopenapi' => ['/api/docs.jsonopenapi', []];
        yield 'docs with no Accept' => ['/api/docs', []];
        yield 'docs as json' => ['/api/docs', ['HTTP_ACCEPT' => 'application/json']];
        yield 'docs as openapi' => ['/api/docs', ['HTTP_ACCEPT' => 'application/vnd.openapi+json']];
    }

    /** @param array<string, string> $server */
    #[Test]
    #[DataProvider('documentRequests')]
    public function theOpenapiDocumentIsStillServed(string $path, array $server): void
    {
        $this->client->request('GET', $path, server: $server);

        self::assertResponseIsSuccessful();
        $document = Json\typed((string) $this->client->getResponse()->getContent(), Type\dict(Type\string(), Type\mixed()));
        self::assertArrayHasKey('openapi', $document);
        self::assertArrayHasKey('paths', $document);
    }

    #[Test]
    public function thereIsNoHtmlDocumentation(): void
    {
        $this->client->request('GET', '/api/docs', server: ['HTTP_ACCEPT' => 'text/html']);
        self::assertResponseStatusCodeSame(404);

        $this->client->request('GET', '/api/docs.html');
        self::assertResponseStatusCodeSame(404);
    }

    /**
     * @param array<string, string> $server
     *
     * @return list<mixed>
     */
    private function problem(string $method, string $path, array $server = []): array
    {
        $this->client->request($method, $path, server: $server);

        $response = $this->client->getResponse();
        $where = Str\format('%s %s', $method, $path);
        self::assertSame(404, $response->getStatusCode(), $where);
        self::assertSame('application/problem+json', $response->headers->get('Content-Type'), $where);

        $body = Json\typed((string) $response->getContent(), Type\dict(Type\string(), Type\mixed()));
        self::assertArrayNotHasKey('@context', $body, $where);
        self::assertArrayNotHasKey('@id', $body, $where);
        self::assertArrayNotHasKey('@type', $body, $where);

        return [$body['type'], $body['title'], $body['status']];
    }
}
