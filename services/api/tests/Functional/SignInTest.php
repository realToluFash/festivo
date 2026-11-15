<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Attempts\GuardedAttempt;
use App\Domain\User\Controller\SignInController;
use App\Domain\User\Http\SignInResponse;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\SignInAttempts;
use App\Domain\User\UserAuthenticator;
use App\Domain\User\UserRegistrar;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\Json;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;
use Symfony\Component\Yaml\Yaml;

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

    /** The gate is decided from this response, so it must not need a second request to /me. */
    /** NIST SP 800-63B-4 forbids forcing a change without evidence of compromise, so a raised minimum binds only the next one set. */
    #[Test]
    public function aPasswordSetUnderTheOldTwelveCharacterRuleStillSignsIn(): void
    {
        $user = $this->account('twelve@example.com');
        $user->setPassword(self::service(PasswordResolver::class)->hash('twelve chars'));
        self::em()->flush();

        $this->signIn('twelve@example.com', 'twelve chars');

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function itReturnsTheAccountAsMeDoes(): void
    {
        $this->account('signin-account@example.com');

        $body = $this->signIn('signin-account@example.com', self::PASSWORD);

        $this->client->request('GET', '/api/auth/me', server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . Type\string()->assert($body['accessToken']),
        ]);
        $me = Json\decode((string) $this->client->getResponse()->getContent());

        self::assertSame($me, $body['account']);
    }

    #[Test]
    public function theAddressIsNormalisedTheSameWayRegistrationNormalisedIt(): void
    {
        $this->account('mixed.case@example.com');

        $this->signIn('  Mixed.Case@EXAMPLE.com ', self::PASSWORD);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

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
    public function aNumberForTheAddressIsRefusedAsTheWrongShapeRatherThanAnUnknownAddress(): void
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => 123, 'password' => self::PASSWORD]));

        $body = Json\typed((string) $this->client->getResponse()->getContent(), Type\dict(Type\string(), Type\mixed()));

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type']);
        self::assertSame(['email', 'invalid_shape'], [$body['violations'][0]['propertyPath'] ?? null, $body['violations'][0]['code'] ?? null]);
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

    #[Test]
    public function theEndpointRefusesWhenEitherBudgetIsGone(): void
    {
        $authenticator = self::service(UserAuthenticator::class);
        $open = self::serviceById('limiter.sign_in_ip', RateLimiterFactoryInterface::class);

        foreach ([[new RefusingRateLimiterFactory(), $open], [$open, new RefusingRateLimiterFactory()]] as [$a, $b]) {
            $controller = new SignInController(self::service(SignInResponse::class), new SignInAttempts($authenticator, self::em(), $b, $a, new GuardedAttempt(self::em())));

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
                self::assertMatchesRegularExpression('/Try again at \d\d:\d\d UTC\./', self::worded($e));
            }
        }
    }

    #[Test]
    public function theStatedMinuteIsOneTheBudgetIsBackBy(): void
    {
        $authenticator = self::service(UserAuthenticator::class);
        $open = self::serviceById('limiter.sign_in_ip', RateLimiterFactoryInterface::class);

        foreach ([
            '22:45:10' => '22:46',
            '22:45:58' => '22:46',
            '22:45:59' => '22:46',
            '22:46:00' => '22:47',
        ] as $windowEnd => $stated) {
            $controller = new SignInController(
                self::service(SignInResponse::class),
                new SignInAttempts($authenticator, self::em(), $open, new RefusingRateLimiterFactory(new DateTimeImmutable('2026-10-15 ' . $windowEnd . ' UTC')), new GuardedAttempt(self::em())),
            );

            try {
                $controller->signIn(self::request('anybody@example.com', 'does not matter'));
                self::fail('the endpoint accepted a request with no budget left');
            } catch (ApiException $e) {
                self::assertStringEndsWith(
                    'Try again at ' . $stated . ' UTC.',
                    self::worded($e),
                    'a window ending at ' . $windowEnd . ' must not name a minute the budget is still spent in',
                );
            }
        }
    }

    /** sc-11329: the minute `Date` plus `Retry-After` reaches, in UTC and saying so, whatever zone the account or the device is in. */
    #[Test]
    #[DataProvider('theFourLanguages')]
    public function theLockedSignInNamesItsMinuteInUtc(string $locale, string $sentence, string $atOne): void
    {
        $this->account('locked@example.com')->setTimezone('Africa/Lagos');
        self::em()->flush();

        $this->client->disableReboot();
        self::getContainer()->set('limiter.sign_in_account', new RefusingRateLimiterFactory());
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT_LANGUAGE' => $locale,
            'HTTP_X_TIMEZONE' => 'Asia/Tokyo',
        ], content: Json\encode(['email' => 'locked@example.com', 'password' => self::PASSWORD]));

        $response = $this->client->getResponse();
        self::assertSame(429, $response->getStatusCode());
        $date = $response->headers->getDate('Date');
        self::assertNotNull($date);
        $reached = $date->getTimestamp() + (int) $response->headers->get('Retry-After');
        $minute = new DateTimeImmutable('@' . (string) (Math\div($reached + 59, 60) * 60))->format('H:i');
        $body = Json\typed((string) $response->getContent(), Type\dict(Type\string(), Type\mixed()));
        self::assertSame(Str\format(Str\starts_with($minute, '01:') ? $atOne : $sentence, $minute), $body['detail'] ?? null);
        self::assertArrayNotHasKey('retryAt', $body);
    }

    /** @return iterable<string, array{string, string, string}> the sentence, and the one Spanish and Portuguese use within the hour of 01:00 */
    public static function theFourLanguages(): iterable
    {
        yield 'en' => ['en', 'Too many sign-in attempts. Try again at %s UTC.', 'Too many sign-in attempts. Try again at %s UTC.'];
        yield 'es' => ['es', 'Demasiados intentos de inicio de sesión. Inténtelo de nuevo a las %s UTC.', 'Demasiados intentos de inicio de sesión. Inténtelo de nuevo a la %s UTC.'];
        yield 'fr' => ['fr', 'Trop de tentatives de connexion. Réessayez à %s UTC.', 'Trop de tentatives de connexion. Réessayez à %s UTC.'];
        yield 'pt' => ['pt', 'Demasiadas tentativas de início de sessão. Tente novamente às %s UTC.', 'Demasiadas tentativas de início de sessão. Tente novamente à %s UTC.'];
    }

    #[Test]
    public function aSuccessSpendsNoneOfTheBudget(): void
    {
        $this->account('often@example.com');
        $controller = self::controllerWithBudget(1, '15 minutes');

        for ($i = 0; $i < 3; ++$i) {
            self::assertSame(200, $controller->signIn(self::request('often@example.com', self::PASSWORD))->getStatusCode());
        }
    }

    #[Test]
    public function aRefusedPasswordSpendsIt(): void
    {
        $this->account('guessed@example.com');
        $controller = self::controllerWithBudget(2, '15 minutes');

        self::assertSame(ErrorCode::InvalidCredentials, self::refusal($controller, 'guessed@example.com', 'a wrong guess')->errorCode);
        self::assertSame(ErrorCode::TooManyAttempts, self::refusal($controller, 'guessed@example.com', 'a wrong guess')->errorCode, 'the guess that spends the budget is the pause');
        self::assertSame(ErrorCode::TooManyAttempts, self::refusal($controller, 'guessed@example.com', self::PASSWORD)->errorCode);
    }

    /** The regression QA found: told a time, refused after it, and told a later one each time. */
    #[Test]
    public function theStatedTimeHoldsStillAndIsHonoured(): void
    {
        $this->account('patient@example.com');
        $controller = self::controllerWithBudget(1, '3 seconds');

        self::refusal($controller, 'patient@example.com', 'a wrong guess');
        $first = self::statedMoment(self::refusal($controller, 'patient@example.com', self::PASSWORD));

        Async\sleep(Duration::milliseconds(1_100));
        $second = self::statedMoment(self::refusal($controller, 'patient@example.com', self::PASSWORD));
        self::assertEqualsWithDelta($first, $second, 1, 'the time moved while nobody was spending the budget');

        Async\sleep(Duration::milliseconds((int) Math\maxva(0, ($second - \microtime(true)) * 1_000)));
        self::assertSame(200, $controller->signIn(self::request('patient@example.com', self::PASSWORD))->getStatusCode());
    }

    #[Test]
    public function theThirtiethWrongPasswordFromOneIpIsThePauseWhateverTheAddress(): void
    {
        $limit = static fn (string $id, int $count): RateLimiterFactory => new RateLimiterFactory(['id' => $id, 'policy' => 'fixed_window', 'limit' => $count, 'interval' => '15 minutes'], new InMemoryStorage());
        $controller = new SignInController(self::service(SignInResponse::class), new SignInAttempts(self::service(UserAuthenticator::class), self::em(), $limit('ip', 30), $limit('account', 5), new GuardedAttempt(self::em())));

        for ($i = 1; $i <= 29; ++$i) {
            self::assertSame(ErrorCode::InvalidCredentials, self::refusal($controller, 'walker' . $i . '@example.com', 'a wrong guess')->errorCode, 'attempt ' . $i);
        }

        self::assertSame(ErrorCode::TooManyAttempts, self::refusal($controller, 'walker30@example.com', 'a wrong guess')->errorCode, 'the thirtieth spends the budget (sc-965)');

        self::assertSame(ErrorCode::TooManyAttempts, self::refusal($controller, 'walker31@example.com', 'a wrong guess')->errorCode);
    }

    /** The tests above build fixed windows; this holds the configured ones to the same policy. */
    #[Test]
    public function theConfiguredBudgetsAreFixedWindows(): void
    {
        $file = Type\string()->assert(self::getContainer()->getParameter('kernel.project_dir'))
            . '/config/packages/rate_limiter.yaml';

        $limiters = Type\shape([
            'framework' => Type\shape([
                'rate_limiter' => Type\dict(Type\string(), Type\shape(['policy' => Type\string()], true)),
            ], true),
        ], true)->coerce(Yaml::parseFile($file));

        foreach (['sign_in_account', 'sign_in_ip'] as $name) {
            self::assertSame(
                'fixed_window',
                $limiters['framework']['rate_limiter'][$name]['policy'],
                $name . ': a sliding window states a time that drifts and is not honoured when it arrives',
            );
        }
    }

    private static function controllerWithBudget(int $limit, string $interval): SignInController
    {
        $factory = static fn (string $id): RateLimiterFactory => new RateLimiterFactory(
            ['id' => $id, 'policy' => 'fixed_window', 'limit' => $limit, 'interval' => $interval],
            new InMemoryStorage(),
        );

        return new SignInController(self::service(SignInResponse::class), new SignInAttempts(self::service(UserAuthenticator::class), self::em(), $factory('ip'), $factory('account'), new GuardedAttempt(self::em())));
    }

    private static function refusal(SignInController $controller, string $email, #[SensitiveParameter] string $password): ApiException
    {
        try {
            $controller->signIn(self::request($email, $password));
        } catch (ApiException $e) {
            return $e;
        }

        self::fail('the sign-in was accepted');
    }

    private static function statedMoment(ApiException $refusal): float
    {
        self::assertSame(ErrorCode::TooManyAttempts, $refusal->errorCode);

        return \microtime(true) + (int) $refusal->headers['Retry-After'];
    }

    private static function request(string $email, #[SensitiveParameter] string $password): Request
    {
        return Request::create('/api/auth/login', 'POST', content: Json\encode([
            'email' => $email,
            'password' => $password,
        ]));
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
