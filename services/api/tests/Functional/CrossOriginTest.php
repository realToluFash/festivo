<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\Test;
use Psl\Str;

/**
 * The refresh token rides in a cookie, and a cross-origin request does not
 * carry one unless the API says so by name. That makes this configuration part
 * of how a session is held rather than a convenience for the front end.
 */
final class CrossOriginTest extends ApiTestCase
{
    private const string ALLOWED = 'https://app.soirely.test';

    #[Test]
    public function ourOwnWebAppMayCallTheApiWithItsCookieAttached(): void
    {
        $this->get('/api/health', self::ALLOWED);

        $headers = $this->client->getResponse()->headers;

        self::assertSame(self::ALLOWED, $headers->get('Access-Control-Allow-Origin'));
        self::assertSame('true', $headers->get('Access-Control-Allow-Credentials'));
    }

    #[Test]
    public function anybodyElseGetsNoPermissionAtAll(): void
    {
        $this->get('/api/health', 'https://example.net');

        self::assertNull($this->client->getResponse()->headers->get('Access-Control-Allow-Origin'));
    }

    /**
     * The failure an exact list exists to prevent. Every widened pattern in the
     * wild has been an unanchored regex, and this is the string it lets in.
     */
    #[Test]
    public function anOriginThatMerelyStartsWithOursIsNotOurs(): void
    {
        foreach ([
            self::ALLOWED . '.example.net',
            'https://evil.app.soirely.test',
            'http://app.soirely.test',
            self::ALLOWED . ':8443',
        ] as $origin) {
            $this->get('/api/health', $origin);

            self::assertNull(
                $this->client->getResponse()->headers->get('Access-Control-Allow-Origin'),
                $origin . ' was allowed',
            );
        }
    }

    /**
     * A wildcard with credentials is refused by every browser, so shipping one
     * would not be a hole — it would be a web client that simply stops working,
     * and the error names CORS rather than the configuration.
     */
    #[Test]
    public function itNeverAnswersWithAWildcard(): void
    {
        $this->get('/api/health', self::ALLOWED);

        self::assertNotSame('*', $this->client->getResponse()->headers->get('Access-Control-Allow-Origin'));
    }

    #[Test]
    public function aPreflightAllowsWhatSignInActuallyNeeds(): void
    {
        $this->client->request('OPTIONS', '/api/auth/login', server: [
            'HTTP_ORIGIN' => self::ALLOWED,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type',
        ]);

        $headers = $this->client->getResponse()->headers;

        self::assertSame(self::ALLOWED, $headers->get('Access-Control-Allow-Origin'));
        self::assertSame('true', $headers->get('Access-Control-Allow-Credentials'));
        self::assertStringContainsString('POST', (string) $headers->get('Access-Control-Allow-Methods'));
        self::assertStringContainsString(
            'content-type',
            Str\lowercase((string) $headers->get('Access-Control-Allow-Headers')),
        );
    }

    /**
     * A header the browser cannot read is a header the client does not have.
     * Retry-After is the whole content of "try again at 14:32", and without it
     * the sign-in screen can only say that something went wrong.
     */
    #[Test]
    public function theClientCanReadTheHeadersItBranchesOn(): void
    {
        $this->get('/api/health', self::ALLOWED);

        $exposed = Str\lowercase((string) $this->client->getResponse()->headers->get('Access-Control-Expose-Headers'));

        self::assertStringContainsString('retry-after', $exposed);
        self::assertStringContainsString('link', $exposed);
    }

    /** Being allowed to ask is not being allowed in. */
    #[Test]
    public function anAllowedOriginStillHasToBeSignedIn(): void
    {
        $this->get('/api/auth/me', self::ALLOWED);

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
        self::assertSame(
            self::ALLOWED,
            $this->client->getResponse()->headers->get('Access-Control-Allow-Origin'),
            'and the refusal is readable, or the client sees a CORS error instead of the reason',
        );
    }

    private function get(string $path, string $origin): void
    {
        $this->client->request('GET', $path, server: ['HTTP_ORIGIN' => $origin]);
    }
}
