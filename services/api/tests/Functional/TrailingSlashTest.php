<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Routing\Exception\ExceptionInterface;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Uid\Uuid;

final class TrailingSlashTest extends ApiTestCase
{
    use OnboardsAccounts;

    #[Test]
    public function aListWithATrailingSlashIsTheSame404AsAnUnknownPath(): void
    {
        $unknown = $this->problem('/api/no-such-thing');

        $body = $this->problem('/api/orgs/');

        self::assertResponseStatusCodeSame(404);
        self::assertResponseNotHasHeader('Location');
        self::assertSame(
            [$unknown['type'], $unknown['title'], $unknown['status']],
            [$body['type'], $body['title'], $body['status']],
        );
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

        $this->client->request('GET', '/api/orgs/');

        self::assertResponseStatusCodeSame(404);
        self::assertResponseNotHasHeader('Location');
    }

    #[Test]
    public function everyRouteWithASlashAddedIsA404WithNoRedirect(): void
    {
        $router = self::service(RouterInterface::class);
        $routes = $router->getRouteCollection()->all();

        foreach ($routes as $name => $route) {
            if (Str\ends_with($route->getPath(), '/') || !Str\starts_with($route->getPath(), '/api')) {
                continue;
            }

            $path = Regex\replace_with($route->getPath(), '/\{(\w+)\}/', static fn (array $parameter): string => (string) (
                $route->getDefault($parameter[1]) ?? Uuid::v7()->toRfc4122()
            )) . '/';

            self::assertNull(self::routeMatching($router, $path), Str\format('%s (%s) is claimed by a route', $path, $name));

            foreach ($route->getMethods() ?: ['GET'] as $method) {
                $this->client->request($method, $path);

                self::assertResponseStatusCodeSame(404, Str\format('%s %s (%s)', $method, $path, $name));
                self::assertResponseNotHasHeader('Location', Str\format('%s %s (%s)', $method, $path, $name));
            }
        }
    }

    private static function routeMatching(RouterInterface $router, string $path): ?string
    {
        try {
            return Type\string()->coerce($router->match($path)['_route']);
        } catch (ExceptionInterface) {
            return null;
        }
    }

    /** @return array<string, mixed> */
    private function problem(string $path): array
    {
        $this->client->request('GET', $path);

        return Json\typed((string) $this->client->getResponse()->getContent(), Type\dict(Type\string(), Type\mixed()));
    }
}
