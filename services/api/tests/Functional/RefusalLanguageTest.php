<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;

/** sc-10700: a refusal's detail and its violations' messages are in the language its title is in. */
final class RefusalLanguageTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @return iterable<string, array{string, string}> */
    public static function languages(): iterable
    {
        yield 'en' => ['en', 'en'];
        yield 'an unknown language' => ['xx', 'en'];
        yield 'pt-BR' => ['pt-BR', 'pt'];

        foreach (['es', 'fr', 'pt'] as $language) {
            yield $language => [$language, $language];
        }
    }

    #[Test]
    #[DataProvider('languages')]
    public function aFieldRefusalIsInTheRequestsLanguage(string $asked, string $catalogue): void
    {
        $user = self::service(UserRegistrar::class)->register(Str\format('refused-%s@example.com', $asked), 'Someone', 'a long enough password 1')->user;
        self::onboard($user);

        $body = $this->call('PUT', '/api/auth/locale', ['locale' => 'de'], $asked, self::service(JWTTokenManagerInterface::class)->create($user));

        self::assertResponseStatusCodeSame(422);
        self::assertSame(self::catalogue('errors', $catalogue)['validation_failed'] ?? null, $body['title']);
        self::assertSame(self::catalogue('messages', $catalogue)['validation.locale_invalid'], $body['violations'][0]['message']);
        self::assertSame(self::catalogue('messages', $catalogue)['validation.locale_invalid'], $body['detail']);
    }

    #[Test]
    public function theLocaleParameterOutranksTheHeader(): void
    {
        $user = self::service(UserRegistrar::class)->register('refused-by-parameter@example.com', 'Someone', 'a long enough password 1')->user;
        self::onboard($user);

        $body = $this->call('PUT', '/api/auth/locale?locale=fr', ['locale' => 'de'], 'en', self::service(JWTTokenManagerInterface::class)->create($user));

        self::assertNotSame(self::catalogue('messages', 'en')['validation.locale_invalid'], self::catalogue('messages', 'fr')['validation.locale_invalid']);
        self::assertSame(self::catalogue('messages', 'fr')['validation.locale_invalid'], $body['violations'][0]['message']);
        self::assertSame(self::catalogue('messages', 'fr')['validation.locale_invalid'], $body['detail']);
    }

    #[Test]
    #[DataProvider('languages')]
    public function theAccessLayersRefusalIsInTheRequestsLanguage(string $asked, string $catalogue): void
    {
        $body = $this->call('GET', '/api/auth/me', null, $asked);

        self::assertResponseStatusCodeSame(401);
        self::assertSame(self::catalogue('messages', $catalogue)['access.sign_in'], $body['detail']);
    }

    #[Test]
    #[DataProvider('languages')]
    public function anUnknownAddressReadsAsTheAccessLayersNotFound(string $asked, string $catalogue): void
    {
        $body = $this->call('GET', '/api/no-such-thing', null, $asked);

        self::assertResponseStatusCodeSame(404);
        self::assertSame(self::catalogue('messages', $catalogue)['access.not_found'], $body['detail']);
    }

    #[Test]
    #[DataProvider('languages')]
    public function aRefusedMethodIsNamedInTheRequestsLanguage(string $asked, string $catalogue): void
    {
        $body = $this->call('PUT', '/api/orgs', null, $asked);

        self::assertResponseStatusCodeSame(405);
        self::assertSame(Str\replace(self::catalogue('messages', $catalogue)['request.method_not_accepted'], '{method}', 'PUT'), $body['detail']);
        self::assertResponseHasHeader('Allow');
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body, string $language, #[SensitiveParameter] ?string $token = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => null === $token ? '' : 'Bearer ' . $token,
            'HTTP_ACCEPT_LANGUAGE' => $language,
        ], content: null === $body ? null : Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
    }

    /** @return array<string, string> */
    private static function catalogue(string $domain, string $language): array
    {
        return Type\dict(Type\string(), Type\string())->coerce(Json\decode(File\read(Str\format('%s/translations/%s.%s.json', \dirname(__DIR__, 2), $domain, $language))));
    }
}
