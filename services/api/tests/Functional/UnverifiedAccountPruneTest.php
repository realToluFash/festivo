<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UnverifiedAccountPruner;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Repository\EmailAddressRepository;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use DateTimeImmutable;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Uid\Uuid;

final class UnverifiedAccountPruneTest extends ApiTestCase
{
    use ClockSensitiveTrait;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function anAccountUnverifiedAfterSevenDaysIsDeleted(): void
    {
        $id = $this->register('never@example.com');

        self::mockTime('+7 days +1 minute');
        $this->prune();

        self::assertNull($this->find($id));
        self::assertNull(self::service(EmailAddressRepository::class)->findOneByAddress('never@example.com'), 'the address is free');
    }

    #[Test]
    public function anAccountInsideItsWeekIsKept(): void
    {
        $id = $this->register('this-week@example.com');

        self::mockTime('+6 days');
        $this->prune();

        self::assertNotNull($this->find($id));
    }

    #[Test]
    public function aVerifiedAccountIsKeptHoweverOld(): void
    {
        $id = $this->register('verified@example.com');
        $address = self::service(EmailAddressRepository::class)->findOneByAddress('verified@example.com');
        self::assertNotNull($address);
        $address->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();

        self::mockTime('+30 days');
        $this->prune();

        self::assertNotNull($this->find($id));
    }

    #[Test]
    public function itDeletesMoreAccountsThanOneBatchHolds(): void
    {
        $ids = [];
        for ($i = 0; $i < 5; ++$i) {
            $ids[] = $this->register('batch-' . $i . '@example.com');
        }

        self::mockTime('+8 days');
        $deleted = self::service(UnverifiedAccountPruner::class)->prune(2);

        self::assertGreaterThanOrEqual(5, $deleted);
        foreach ($ids as $id) {
            self::assertNull($this->find($id));
        }
    }

    #[Test]
    public function aDryRunCountsAndDeletesNothing(): void
    {
        $id = $this->register('dry-run@example.com');

        self::mockTime('+8 days');
        $output = $this->prune(['--dry-run' => true]);

        self::assertMatchesRegularExpression('/Would delete [1-9]\d* unverified accounts\./', $output);
        self::assertNotNull($this->find($id));
    }

    /** @param array<string, mixed> $input */
    private function prune(array $input = []): string
    {
        $application = new Application(self::$kernel ?? throw new LogicException('No kernel.'));
        $tester = new CommandTester($application->find('app:prune-unverified-accounts'));
        $tester->execute($input);
        $tester->assertCommandIsSuccessful();

        return $tester->getDisplay();
    }

    private function register(string $address): Uuid
    {
        $result = self::service(UserRegistrar::class)->register($address, 'Unverified', self::PASSWORD);

        return $result->user->getId();
    }

    private function find(Uuid $id): ?User
    {
        self::em()->clear();

        return self::service(UserRepository::class)->find($id);
    }
}
