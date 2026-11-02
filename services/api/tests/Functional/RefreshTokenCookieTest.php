<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\RefreshToken;
use App\Enum\ErrorCode;
use App\Http\RefreshTokenCookies;
use App\Repository\RefreshTokenRepository;
use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Symfony\Component\BrowserKit\Cookie as BrowserKitCookie;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\Mime\Email;

final class RefreshTokenCookieTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function aBrowserIsNeverHandedTheRefreshTokenItselfOnSignIn(): void
    {
        $this->account('cookie-signin@example.com');

        $body = $this->signIn('cookie-signin@example.com');

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertNotSame('', $body['accessToken'], 'the access token still comes back to be held in memory');
        self::assertArrayNotHasKey(
            'refreshToken',
            $body,
            'a token in the body is a token in the page, which is the whole thing this avoids',
        );
        self::assertNotNull($this->cookie());
    }

    #[Test]
    public function registeringFromABrowserPutsItInTheCookieToo(): void
    {
        $this->client->request('POST', '/api/auth/register', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode([
            'email' => 'cookie-register@example.com',
            'name' => 'Cookie Register',
            'password' => self::PASSWORD,
        ]));
        $handle = Type\string()->coerce($this->decode()['registration']);
        $mail = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        $code = Regex\first_match((string) $mail->getTextBody(), '/\b(\d{6})\b/')[1] ?? '';

        $this->client->request('POST', '/api/auth/register/verify', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['registration' => $handle, 'code' => $code, 'refreshTokenIn' => 'cookie']));

        self::assertSame(201, $this->client->getResponse()->getStatusCode());
        self::assertArrayNotHasKey('refreshToken', $this->decode());
        self::assertNotNull($this->cookie(), 'the code signs you in, so it is the same moment');
    }

    #[Test]
    public function theCookieCannotBeReadByThePageAndTravelsOnlyToTheRoutesThatUseIt(): void
    {
        $this->account('attributes@example.com');
        $this->signIn('attributes@example.com');

        $cookie = $this->cookie();

        self::assertNotNull($cookie);
        self::assertTrue($cookie->isHttpOnly(), 'HttpOnly is the point: a script cannot read it');
        self::assertSame(Cookie::SAMESITE_STRICT, $cookie->getSameSite());
        self::assertSame('/api/auth', $cookie->getPath());
        self::assertNull($cookie->getDomain(), 'host-only, so no sibling subdomain receives it');
    }

    #[Test]
    public function itIsSecureEverywhereButLoopback(): void
    {
        $this->account('secure@example.com');

        $this->signIn('secure@example.com');
        self::assertFalse($this->cookie()?->isSecure(), 'loopback serves plain HTTP in development');

        $this->client->request('POST', 'https://app.soirely.test/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode([
            'email' => 'secure@example.com',
            'password' => self::PASSWORD,
            'refreshTokenIn' => 'cookie',
        ]));

        self::assertTrue($this->cookie()?->isSecure());
    }

    #[Test]
    public function refreshingSendsNoTokenAndGetsANewCookieBack(): void
    {
        $this->account('cookie-refresh@example.com');
        $this->signIn('cookie-refresh@example.com');

        $first = $this->cookieValue();
        $body = $this->refreshFromCookie();

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertArrayNotHasKey('refreshToken', $body);
        self::assertNotSame($first, $this->cookieValue(), 'the cookie rotated with the token inside it');

        self::em()->clear();
        self::assertNotNull($this->find((string) $first)?->getRevokedAt());
    }

    #[Test]
    public function replayingAnOldCookieStillRevokesTheWholeChain(): void
    {
        $this->account('cookie-replay@example.com');
        $this->signIn('cookie-replay@example.com');

        $first = (string) $this->cookieValue();
        $this->refreshFromCookie();
        $second = (string) $this->cookieValue();

        $this->presentCookie($first);
        $body = $this->refreshFromCookie();

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::InvalidRefreshToken->type(), $body['type']);

        self::em()->clear();
        foreach ([$first, $second] as $plain) {
            self::assertNotNull($this->find($plain)?->getRevokedAt());
        }
    }

    #[Test]
    public function aMissingCookieEndsTheSessionRatherThanErroring(): void
    {
        $body = $this->refreshFromCookie();

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::InvalidRefreshToken->type(), $body['type']);
    }

    #[Test]
    public function signingOutClearsTheCookieAndRevokesTheToken(): void
    {
        $this->account('cookie-signout@example.com');
        $this->signIn('cookie-signout@example.com');
        $plain = (string) $this->cookieValue();

        $this->client->request('POST', '/api/auth/logout', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshTokenIn' => 'cookie']));

        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        $cleared = $this->cookie();
        self::assertNotNull($cleared, 'the response has to carry the replacement, or the browser keeps the old one');
        self::assertLessThan(
            \time(),
            $cleared->getExpiresTime(),
            'already expired, so it is not left for the next person at this browser',
        );

        self::em()->clear();
        self::assertNotNull($this->find($plain)?->getRevokedAt());
    }

    #[Test]
    public function signingOutWithNoCookieSucceeds(): void
    {
        $this->client->request('POST', '/api/auth/logout', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshTokenIn' => 'cookie']));

        self::assertSame(204, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function aFormPostCarryingTheCookieIsRefusedAndCostsNothing(): void
    {
        $this->account('forged@example.com');
        $this->signIn('forged@example.com');
        $plain = (string) $this->cookieValue();

        $this->client->request('POST', '/api/auth/refresh', parameters: ['refreshTokenIn' => 'cookie']);

        self::assertSame(400, $this->client->getResponse()->getStatusCode());

        self::em()->clear();
        self::assertNull($this->find($plain)?->getRevokedAt(), 'the forged request did not spend the token');

        $this->presentCookie($plain);
        $this->refreshFromCookie();
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), 'and the session still works');
    }

    #[Test]
    public function aNativeClientIsUnaffectedAndGetsNoCookie(): void
    {
        $this->account('native@example.com');

        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => 'native@example.com', 'password' => self::PASSWORD]));

        $body = $this->decode();

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertNotSame('', $body['refreshToken']);
        self::assertNull($this->cookie(), 'nothing to store in a Keychain-backed client');
    }

    #[Test]
    public function aBodyClientThatForgetsTheTokenIsToldWhichFieldIsMissing(): void
    {
        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: '{}');

        $body = $this->decode();

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type']);
        self::assertSame('refreshToken', $body['violations'][0]['propertyPath']);
        self::assertSame('blank', $body['violations'][0]['code']);
        self::assertSame('This field cannot take that value. Check it and try again.', $body['violations'][0]['message']);
    }

    /** @mago-expect lint:no-literal-password */
    #[Test]
    public function anUnknownDeliveryIsRefusedRatherThanTreatedAsTheDefault(): void
    {
        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshTokenIn' => 'localstorage', 'refreshToken' => 'well-formed']));

        $body = $this->decode();

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertStringContainsString(
            'refreshTokenIn',
            Json\encode($body['violations']),
            'the delivery is what was refused, not the token beside it',
        );
        self::assertSame('invalid_shape', $body['violations'][0]['code']);
    }

    private function account(string $address): void
    {
        self::service(UserRegistrar::class)->register($address, 'Cookie', self::PASSWORD);
        self::em()->flush();
    }

    /** @return array<string, mixed> */
    private function signIn(string $address): array
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode([
            'email' => $address,
            'password' => self::PASSWORD,
            'refreshTokenIn' => 'cookie',
        ]));

        return $this->decode();
    }

    /** @return array<string, mixed> */
    private function refreshFromCookie(): array
    {
        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['refreshTokenIn' => 'cookie']));

        return $this->decode();
    }

    private function presentCookie(string $value): void
    {
        $this->client->getCookieJar()->set(
            new BrowserKitCookie(RefreshTokenCookies::NAME, $value, null, '/api/auth', 'localhost'),
        );
    }

    private function cookie(): ?Cookie
    {
        foreach ($this->client->getResponse()->headers->getCookies() as $cookie) {
            if (RefreshTokenCookies::NAME === $cookie->getName()) {
                return $cookie;
            }
        }

        return null;
    }

    private function cookieValue(): ?string
    {
        return $this->cookie()?->getValue();
    }

    private function find(string $plain): ?RefreshToken
    {
        return self::service(RefreshTokenRepository::class)->findOneByHash(TokenIssuer::hash($plain));
    }

    /** @return array<string, mixed> */
    private function decode(): array
    {
        $content = (string) $this->client->getResponse()->getContent();

        if ('' === $content) {
            return [];
        }

        return Json\typed($content, \Psl\Type\dict(\Psl\Type\string(), \Psl\Type\mixed()));
    }
}
