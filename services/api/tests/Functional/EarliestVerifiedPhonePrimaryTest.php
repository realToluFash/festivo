<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Type;
use Psl\Vec;

final class EarliestVerifiedPhonePrimaryTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function anAccountWithVerifiedNumbersAndNoPrimaryGetsItsEarliestVerified(): void
    {
        $user = $this->account('no-primary@example.com');
        $this->phone($user, '+2348035550101', '2026-10-17 12:00:00');
        $this->phone($user, '+2348035550102', '2026-10-16 09:00:00');
        $this->phone($user, '+2348035550103', null);

        $this->migrate();

        self::assertSame(['+2348035550101' => false, '+2348035550102' => true, '+2348035550103' => false], $this->primaries($user));
    }

    #[Test]
    public function aVerifiedNumberTakesPrimaryFromAnUnverifiedOneWhichStaysLinked(): void
    {
        $user = $this->account('unverified-primary@example.com');
        $this->phone($user, '+2348035550401', null, true);
        $this->phone($user, '+2348035550402', '2026-10-17 12:00:00');

        $this->migrate();

        self::assertSame(['+2348035550401' => false, '+2348035550402' => true], $this->primaries($user));
    }

    #[Test]
    public function anAccountWithAVerifiedPrimaryKeepsIt(): void
    {
        $user = $this->account('has-primary@example.com');
        $this->phone($user, '+2348035550201', '2026-10-18 12:00:00', true);
        $this->phone($user, '+2348035550202', '2026-10-01 09:00:00');

        $this->migrate();

        self::assertSame(['+2348035550201' => true, '+2348035550202' => false], $this->primaries($user));
    }

    #[Test]
    public function anUnverifiedNumberIsNeverMadePrimary(): void
    {
        $user = $this->account('unverified@example.com');
        $this->phone($user, '+2348035550301', null);

        $this->migrate();

        self::assertSame(['+2348035550301' => false], $this->primaries($user));
    }

    #[Test]
    public function anUnverifiedPrimaryWithNothingVerifiedBesideItStays(): void
    {
        $user = $this->account('onboarding@example.com');
        $this->phone($user, '+2348035550501', null, true);

        $this->migrate();

        self::assertSame(['+2348035550501' => true], $this->primaries($user));
    }

    private function migrate(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version('DoctrineMigrations\Version20261018230000'))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            self::em()->getConnection()->executeStatement($query->getStatement());
        }

        self::em()->clear();
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Folake', self::PASSWORD)->user;
        self::em()->flush();

        return $user;
    }

    private function phone(User $user, string $number, ?string $verifiedAt, bool $primary = false): void
    {
        $phone = new PhoneNumber($user, $number, $primary, 'NG');
        $phone->setVerifiedAt(null === $verifiedAt ? null : new DateTimeImmutable($verifiedAt));
        self::em()->persist($phone);
        self::em()->flush();
    }

    /** @return array<string, bool> */
    private function primaries(User $user): array
    {
        $phones = self::em()->getRepository(PhoneNumber::class)->findBy(['user' => $user->getId()]);
        $primaries = Dict\from_entries(Vec\map($phones, static fn (PhoneNumber $phone): array => [$phone->getNumber(), $phone->isPrimary()]));

        return Type\dict(Type\string(), Type\bool())->coerce(Dict\sort_by_key($primaries));
    }
}
