<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Controller\SignInController;
use App\Domain\User\UserAuthenticator;
use App\Domain\User\UserRegistrar;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

final class SignInTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function itReturnsAPairAndASessionId(): void
    {
        $this->account('signin@example.com');

        $body = $this->signIn('signin@example.com', self::PASSWORD);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertNotSame('', $body['accessToken']);
        self::assertNotSame('', $body['refreshToken']);
        self::assertArrayHasKey('refreshExpiresAt', $body);
        self::assertArrayHasKey('sessionId', $body);
    }

    #[Test]
    public function theAddressIsNormalisedTheSameWayRegistrationNormalisedIt(): void
    {
        $this->account('mixed.case@example.com');

        $this->signIn('  Mixed.Case@EXAMPLE.com ', self::PASSWORD);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    /** Byte for byte: two responses sharing a status can still differ in their detail. */
    #[Test]
    public function anUnknownAddressAndAWrongPasswordAreIndistinguishable(): void
    {
        $this->account('known@example.com');

        $wrongPassword = $this->rawResponseFor('known@example.com', 'the wrong passphrase');
        $unknownAddress = $this->rawResponseFor('nobody@example.com', self::PASSWORD);

        self::assertSame($wrongPassword['status'], $unknownAddress['status']);
        self::assertSame(401, $wrongPassword['status']);
        self::assertSame($wrongPassword['body'], $unknownAddress['body']);
    }

    #[Test]
    public function anAlternativeAddressDoesNotSignAnybodyIn(): void
    {
        $user = $this->account('alt-primary@example.com');
        new EmailAddress($user, 'alt-second@example.com');
        self::em()->flush();

        $alternative = $this->rawResponseFor('alt-second@example.com', self::PASSWORD);
        $unknown = $this->rawResponseFor('nobody-at-all@example.com', self::PASSWORD);

        self::assertSame(401, $alternative['status']);
        self::assertSame($unknown['body'], $alternative['body']);
    }

    #[Test]
    public function theProblemDocumentCarriesTheCode(): void
    {
        $body = $this->signIn('nobody@example.com', self::PASSWORD);

        self::assertSame(ErrorCode::InvalidCredentials->type(), $body['type']);
    }

    /** At the factory: framework.test resets the array-backed budget after every request. */
    #[Test]
    public function theAddressBudgetIsTighterThanTheNetworkBudget(): void
    {
        $perAddress = self::countAccepted('limiter.sign_in_account', 'one-address');
        $perIp = self::countAccepted('limiter.sign_in_ip', '203.0.113.7');

        self::assertGreaterThan(0, $perAddress, 'the address budget refused the first attempt');
        self::assertLessThan(
            $perIp,
            $perAddress,
            'a password is guessed by trying many against one account, so that budget has to be the tighter one',
        );
    }

    /** A controller that forgot a limiter passes every other test in this file. */
    #[Test]
    public function theEndpointRefusesWhenEitherBudgetIsGone(): void
    {
        $authenticator = self::service(UserAuthenticator::class);
        $open = self::serviceById('limiter.sign_in_ip', RateLimiterFactoryInterface::class);

        foreach ([[new RefusingRateLimiterFactory(), $open], [$open, new RefusingRateLimiterFactory()]] as [$a, $b]) {
            $controller = new SignInController($authenticator, $b, $a);

            try {
                $controller->signIn(Request::create('/api/auth/login', 'POST', content: Json\encode([
                    'email' => 'anybody@example.com',
                    // @mago-expect lint:no-literal-password
                    'password' => 'does not matter',
                ])));
                self::fail('the endpoint accepted a request with no budget left');
            } catch (ApiException $e) {
                self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode);
                self::assertArrayHasKey('Retry-After', $e->headers);
                self::assertMatchesRegularExpression('/Try again at \d\d:\d\d\./', $e->getMessage());
            }
        }
    }

    private static function countAccepted(string $id, string $key): int
    {
        $limiter = self::serviceById($id, RateLimiterFactoryInterface::class)->create($key);

        $accepted = 0;
        while ($limiter->consume()->isAccepted() && $accepted < 200) {
            ++$accepted;
        }

        return $accepted;
    }

    private function account(string $address): User
    {
        $result = self::service(UserRegistrar::class)->register($address, 'Signer', self::PASSWORD);
        self::em()->flush();

        return $result->user;
    }

    /** @return array{status: int, body: string} */
    private function rawResponseFor(string $email, #[SensitiveParameter] string $password): array
    {
        $this->post($email, $password);

        return [
            'status' => $this->client->getResponse()->getStatusCode(),
            // correlationId differs per request by design.
            'body' => Regex\replace(
                (string) $this->client->getResponse()->getContent(),
                '/"correlationId":"[^"]*"/',
                '',
            ),
        ];
    }

    /** @return array<string, mixed> */
    private function signIn(string $email, #[SensitiveParameter] string $password): array
    {
        $this->post($email, $password);

        return Json\typed(
            (string) $this->client->getResponse()->getContent(),
            \Psl\Type\dict(\Psl\Type\string(), \Psl\Type\mixed()),
        );
    }

    private function post(string $email, #[SensitiveParameter] string $password): void
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => $email, 'password' => $password]));
    }
}
