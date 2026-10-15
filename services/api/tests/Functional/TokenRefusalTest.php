<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Enum\ErrorCode;
use App\Tests\ApiTestCase;
use Lexik\Bundle\JWTAuthenticationBundle\Encoder\JWTEncoderInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;

final class TokenRefusalTest extends ApiTestCase
{
    /** @return iterable<string, array{string}> */
    public static function refusals(): iterable
    {
        yield 'no token' => ['none'];
        yield 'a malformed token' => ['malformed'];
        yield 'an expired token' => ['expired'];
    }

    #[Test]
    #[DataProvider('refusals')]
    public function aRefusedTokenIsAProblemDocument(string $kind): void
    {
        $this->requestMe($kind, 'en');

        $response = $this->client->getResponse();
        self::assertSame(401, $response->getStatusCode());
        self::assertSame('application/problem+json', $response->headers->get('Content-Type'));

        $body = $this->decode();
        self::assertSame(ErrorCode::Unauthenticated->type(), $body['type']);
        self::assertSame(401, $body['status']);
        self::assertIsString($body['correlationId'] ?? null);
    }

    #[Test]
    #[DataProvider('refusals')]
    public function aRefusedTokenIsAnsweredInTheReadersLanguage(string $kind): void
    {
        $this->requestMe($kind, 'fr');

        self::assertSame('Veuillez vous connecter pour continuer.', $this->decode()['title']);
    }

    private function requestMe(string $kind, string $locale): void
    {
        $server = ['HTTP_ACCEPT_LANGUAGE' => $locale];

        $token = match ($kind) {
            'malformed' => 'not-a-token',
            'expired' => $this->expiredToken(),
            default => null,
        };

        if (null !== $token) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        }

        $this->client->request('GET', '/api/auth/me', server: $server);
    }

    private function expiredToken(): string
    {
        $user = self::service(UserRegistrar::class)
            ->register('expired-token@example.com', 'Expired', 'a decent passphrase')
            ->user;

        return self::service(JWTEncoderInterface::class)->encode([
            'username' => $user->getUserIdentifier(),
            'iat' => \time() - 3600,
            'exp' => \time() - 60,
        ]);
    }

    /** @return array<string, mixed> */
    private function decode(): array
    {
        return Json\typed(
            (string) $this->client->getResponse()->getContent(),
            Type\dict(Type\string(), Type\mixed()),
        );
    }
}
