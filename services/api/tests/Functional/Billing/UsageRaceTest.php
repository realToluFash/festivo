<?php

declare(strict_types=1);

namespace App\Tests\Functional\Billing;

use App\Domain\User\Mail\UserMailer;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\DriverManager;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** sc-3929: two organisations on one billing account reserving its last credits at the same moment, each in its own process: one is held, the other refused. */
final class UsageRaceTest extends FunctionalTestCase
{
    private const string SETUP = __DIR__ . '/../../Fixtures/Concurrency/usage-race-setup.php';

    private const string RESERVE = __DIR__ . '/../../Fixtures/Concurrency/usage-race.php';

    /** @var ?array{userId: string, address: string, organisations: list<string>, accounts: list<string>} */
    private ?array $made = null;

    protected function tearDown(): void
    {
        if (null !== $this->made) {
            $elsewhere = DriverManager::getConnection(self::em()->getConnection()->getParams());
            $mail = ['person' => Json\encode(['only' => [UserMailer::person($this->made['address'])->toRfc4122()]])];
            $elsewhere->executeStatement('DELETE FROM notification_deliveries WHERE scheduled_notification_id IN (SELECT id FROM scheduled_notifications WHERE audience @> CAST(:person AS jsonb))', $mail);
            $elsewhere->executeStatement('DELETE FROM scheduled_notifications WHERE audience @> CAST(:person AS jsonb)', $mail);
            $elsewhere->executeStatement('DELETE FROM usage_reservations WHERE billing_account_id = ?', [$this->made['accounts'][0]]);
            $elsewhere->executeStatement('DELETE FROM audit_entries WHERE actor_id = ? OR subject_id IN (?, ?, ?)', [$this->made['userId'], $this->made['userId'], ...$this->made['organisations']]);

            foreach ($this->made['organisations'] as $organisation) {
                $elsewhere->executeStatement('DELETE FROM organisations WHERE id = ?', [$organisation]);
            }

            foreach ($this->made['accounts'] as $account) {
                $elsewhere->executeStatement('DELETE FROM billing_accounts WHERE id = ?', [$account]);
            }

            $elsewhere->executeStatement('DELETE FROM users WHERE id = ?', [$this->made['userId']]);
            $elsewhere->close();
            $this->made = null;
        }

        parent::tearDown();
    }

    #[Test]
    public function twoOrganisationsReservingOneAccountsLastCreditsTogetherHoldThemOnce(): void
    {
        $out = \shell_exec(\escapeshellcmd('php ' . self::SETUP) . ' 2>/dev/null');
        $this->made = Type\shape(['userId' => Type\string(), 'address' => Type\string(), 'organisations' => Type\vec(Type\string()), 'accounts' => Type\vec(Type\string())])->coerce(Json\decode((string) $out));

        // Long enough for every process to boot its kernel before the instant they all reserve at.
        $startAt = (string) (\microtime(true) + 15);
        $processes = Vec\map($this->made['organisations'], static fn (string $organisation): array => self::start($startAt, $organisation));
        $answers = Vec\sort(Vec\map($processes, static function (array $process): string {
            [$handle, $pipes] = $process;
            $out = Str\trim((string) \stream_get_contents($pipes[1]));
            \fclose($pipes[1]);
            \proc_close($handle);

            return $out;
        }));

        self::assertFalse(Iter\contains($answers, 'late'), 'a process missed the instant, so the reservations were not parallel');
        self::assertSame(['held', 'refused'], $answers);
        self::assertSame(
            ['credit_balance' => 62, 'credits_held' => 62],
            Type\shape(['credit_balance' => Type\int(), 'credits_held' => Type\int()])->coerce(self::em()->getConnection()->fetchAssociative('SELECT credit_balance, credits_held FROM billing_accounts WHERE id = ?', [$this->made['accounts'][0]])),
        );
    }

    /** @return array{0: resource, 1: array<int, resource>} */
    private static function start(string ...$arguments): array
    {
        $handle = \proc_open(['php', self::RESERVE, ...$arguments], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
        self::assertIsResource($handle);

        return [$handle, $pipes];
    }
}
