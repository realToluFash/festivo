<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\SignInAttempts;
use App\Domain\User\UserAuthenticator;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Exception\DriverException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

/** sc-838's limits under real concurrency: other processes, or another connection holding a lock. */
final class SignInConcurrencyTest extends FunctionalTestCase
{
    private const string SCRIPT = __DIR__ . '/../Fixtures/Concurrency/sign-in.php';

    private const string VENUE_WIFI = '198.51.100.7';

    #[Test]
    public function twentyParallelGuessesForOneAddressCheckFiveAndRefuseFifteen(): void
    {
        $codes = $this->inParallel(Vec\fill(20, ['guessed@example.com', self::VENUE_WIFI]));

        self::assertSame([401 => 5, 429 => 15], $codes);
    }

    /** Guests on one venue's Wi-Fi share an IP: a sign-in still in its check holds up only its own address. */
    #[Test]
    public function anotherAddressOnTheSameIpNeverWaits(): void
    {
        $elsewhere = DriverManager::getConnection(self::em()->getConnection()->getParams());
        $elsewhere->beginTransaction();
        $elsewhere->executeStatement('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', ['key' => SignInAttempts::lockFor('first@example.com')]);
        self::em()->getConnection()->executeStatement("SET lock_timeout = '2s'");

        try {
            self::assertSame(ErrorCode::InvalidCredentials, $this->refusal('second@example.com'), 'not held up by the first address');
            self::assertNull($this->refusal('first@example.com'), 'the first address does wait');
        } finally {
            $elsewhere->rollBack();
            $elsewhere->close();
            self::em()->getConnection()->executeStatement('SET lock_timeout = 0');
        }
    }

    /** null when the attempt waited out the lock instead of being answered. */
    private function refusal(string $email): ?ErrorCode
    {
        $limit = static fn (string $id, int $count): RateLimiterFactory => new RateLimiterFactory(['id' => $id, 'policy' => 'fixed_window', 'limit' => $count, 'interval' => '15 minutes'], new InMemoryStorage());
        $attempts = new SignInAttempts(self::service(UserAuthenticator::class), self::em(), $limit('ip', 30), $limit('account', 5));

        try {
            $attempts->signIn($email, 'not the password at all', Request::create('/api/auth/login', server: ['REMOTE_ADDR' => self::VENUE_WIFI]));
        } catch (ApiException $e) {
            return $e->errorCode;
        } catch (DriverException $e) {
            if ('55P03' === $e->getSQLState()) {
                return null;
            }

            throw $e;
        }

        self::fail('the sign-in was accepted');
    }

    /** @param list<array{0: string, 1: string}> $attempts address and client IP */
    private function inParallel(array $attempts): array
    {
        $namespace = 'sc838-' . SecureRandom\string(8);
        // Long enough for every process to boot its kernel before the instant they all sign in at.
        $startAt = (string) (\microtime(true) + 15);
        $processes = Vec\map($attempts, static fn (array $attempt): array => self::start($startAt, $attempt[0], $attempt[1], $namespace));

        $codes = Vec\map($processes, static function (array $process): string {
            [$handle, $pipes] = $process;
            $out = Str\trim((string) \stream_get_contents($pipes[1]));
            \fclose($pipes[1]);
            \proc_close($handle);

            return $out;
        });

        self::assertFalse(Iter\contains($codes, 'late'), 'a process missed the instant, so the attempts were not parallel');

        return Dict\sort_by_key(Dict\count_values($codes));
    }

    /** @return array{0: resource, 1: array<int, resource>} */
    private static function start(string ...$arguments): array
    {
        $handle = \proc_open(['php', self::SCRIPT, ...$arguments], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
        self::assertIsResource($handle);

        return [$handle, $pipes];
    }
}
