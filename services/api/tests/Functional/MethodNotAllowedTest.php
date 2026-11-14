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
use Symfony\Component\Uid\Uuid;

final class MethodNotAllowedTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @return iterable<string, array{string, string, list<string>}> */
    public static function wrongMethods(): iterable
    {
        yield 'health' => ['DELETE', '/api/health', ['GET']];
        yield 'organisations' => ['PUT', '/api/orgs', ['GET', 'POST']];
        yield 'an organisation' => ['PUT', '/api/orgs/' . Uuid::v7()->toRfc4122(), ['DELETE', 'PATCH']];
    }

    /** @param list<string> $allowed */
    #[Test]
    #[DataProvider('wrongMethods')]
    public function aWrongMethodNamesTheMethodsThePathTakes(string $method, string $path, array $allowed): void
    {
        $this->client->request($method, $path);

        self::assertSame(405, $this->client->getResponse()->getStatusCode());
        self::assertSame($allowed, $this->allowed());
    }

    /** @param list<string> $allowed */
    #[Test]
    #[DataProvider('wrongMethods')]
    public function aSignedInCallerIsToldTheSameMethods(string $method, string $path, array $allowed): void
    {
        $user = self::service(UserRegistrar::class)->register('member@example.com', 'Member', self::PASSWORD)->user;
        self::onboard($user);

        $this->client->request($method, $path, server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        ]);

        self::assertSame(405, $this->client->getResponse()->getStatusCode());
        self::assertSame($allowed, $this->allowed());
    }

    #[Test]
    public function theBodyIsStillAProblemInTheCallersLanguage(): void
    {
        $titles = [];
        foreach (['en', 'es', 'fr', 'pt'] as $language) {
            $this->client->request('DELETE', '/api/health', server: ['HTTP_ACCEPT_LANGUAGE' => $language]);

            $response = $this->client->getResponse();
            self::assertSame('application/problem+json', $response->headers->get('Content-Type'));

            $body = Json\typed((string) $response->getContent(), Type\shape([
                'type' => Type\string(),
                'title' => Type\string(),
            ], true));
            self::assertSame('https://soirely.com/errors/method_not_allowed', $body['type']);
            $titles[$language] = $body['title'];
        }

        self::assertCount(4, Vec\unique($titles), 'each language has its own title');
    }

    #[Test]
    public function noOtherAnswerCarriesAnAllowHeader(): void
    {
        $this->client->request('GET', '/api/health');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertFalse($this->client->getResponse()->headers->has('Allow'));

        $this->client->request('GET', '/api/no-such-thing');
        self::assertSame(404, $this->client->getResponse()->getStatusCode());
        self::assertFalse($this->client->getResponse()->headers->has('Allow'));

        $this->client->request('GET', '/api/orgs');
        self::assertSame(401, $this->client->getResponse()->getStatusCode());
        self::assertSame('Bearer', $this->client->getResponse()->headers->get('WWW-Authenticate'));
        self::assertFalse($this->client->getResponse()->headers->has('Allow'));
    }

    /** @return list<string> */
    private function allowed(): array
    {
        $methods = Vec\map(
            Str\split((string) $this->client->getResponse()->headers->get('Allow'), ','),
            Str\trim(...),
        );

        return Vec\sort($methods);
    }
}
