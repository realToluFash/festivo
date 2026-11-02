<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Doctrine\Traits\Timestampable;
use App\Entity\User;
use App\Tests\Double\UntimestampedEntity;
use App\Tests\FunctionalTestCase;
use Doctrine\ORM\Mapping as ORM;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Str;
use ReflectionClass;
use Symfony\Component\Finder\Finder;

final class TimestampableTest extends FunctionalTestCase
{
    /**
     * The timestamps are set against a column of TIMESTAMP(0), so two writes in
     * the same second are indistinguishable. Both tests put a known value far
     * in the past first, so the assertion does not depend on how fast the
     * suite runs.
     */
    private const LONG_AGO = '2020-01-01 00:00:00';

    #[Test]
    public function anUpdateMovesUpdatedAtWithoutAnythingCallingIt(): void
    {
        $user = new User('Timestamps', 'hash');
        self::em()->persist($user);
        self::em()->flush();

        $this->backdate($user);

        $reloaded = self::em()->find(User::class, $user->getId());
        self::assertNotNull($reloaded);
        self::assertSame(self::LONG_AGO, $reloaded->getUpdatedAt()->format('Y-m-d H:i:s'));

        // A mutator that does not touch a timestamp itself. This is the whole
        // point: nothing here says "and now record that it changed".
        $reloaded->setLocale('fr');
        self::em()->flush();
        self::em()->clear();

        $after = self::em()->find(User::class, $user->getId());
        self::assertNotNull($after);
        self::assertNotSame(
            self::LONG_AGO,
            $after->getUpdatedAt()->format('Y-m-d H:i:s'),
            'updatedAt did not move, so the PreUpdate callback never fired or its value was not written',
        );
    }

    #[Test]
    public function anUpdateLeavesCreatedAtAlone(): void
    {
        $user = new User('Created', 'hash');
        self::em()->persist($user);
        self::em()->flush();

        $this->backdate($user);

        $reloaded = self::em()->find(User::class, $user->getId());
        self::assertNotNull($reloaded);
        $reloaded->setLocale('es');
        self::em()->flush();
        self::em()->clear();

        $after = self::em()->find(User::class, $user->getId());
        self::assertNotNull($after);
        self::assertSame(self::LONG_AGO, $after->getCreatedAt()->format('Y-m-d H:i:s'));
    }

    /**
     * Every entity using the trait has to carry #[ORM\HasLifecycleCallbacks],
     * and nothing reports it when one does not: Doctrine simply never looks for
     * the callbacks, so the timestamps stop moving and every test still passes.
     */
    #[Test]
    public function everyEntityUsingTheTraitDeclaresItsLifecycleCallbacks(): void
    {
        $missing = [];

        foreach (self::entities() as $class) {
            $reflection = new ReflectionClass($class);

            if (!Iter\contains($reflection->getTraitNames(), Timestampable::class)) {
                continue;
            }

            if ([] === $reflection->getAttributes(ORM\HasLifecycleCallbacks::class)) {
                $missing[] = $class;
            }
        }

        self::assertSame(
            [],
            $missing,
            'Uses Timestampable without #[ORM\HasLifecycleCallbacks], so its timestamps will never move: '
                . Str\join($missing, ', '),
        );
    }

    #[Test]
    public function theGuardCanFail(): void
    {
        $reflection = new ReflectionClass(UntimestampedEntity::class);

        self::assertContains(Timestampable::class, $reflection->getTraitNames());
        self::assertSame([], $reflection->getAttributes(ORM\HasLifecycleCallbacks::class));
    }

    /** @return list<class-string> */
    private static function entities(): array
    {
        $found = [];

        foreach (new Finder()->files()->in(\dirname(__DIR__, 2) . '/src/Entity')->name('*.php') as $file) {
            $class = 'App\\Entity\\' . $file->getBasename('.php');

            if (\class_exists($class)) {
                $found[] = $class;
            }
        }

        return $found;
    }

    private function backdate(User $user): void
    {
        self::em()->getConnection()->executeStatement(
            'UPDATE users SET created_at = :at, updated_at = :at WHERE id = :id',
            ['at' => self::LONG_AGO, 'id' => $user->getId()->toRfc4122()],
        );
        self::em()->clear();
    }
}
