<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Entity\User;
use SensitiveParameter;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactoryInterface;

/**
 * Hashing and verifying must normalise identically or a correct password is
 * refused for one person on one device, with nothing in any log.
 */
final readonly class PasswordResolver
{
    /**
     * Must be a genuine argon2id hash. An invented string fails to parse,
     * verification returns immediately, and the timing oracle below is back
     * with nothing failing to say so. DummyHashTest guards it.
     */
    public const string DUMMY_HASH = '$argon2id$v=19$m=65536,t=2,p=1$8GuLm8bSFsJFhwRIDGGzWg$ZrTd1yGyZzWhWHRxcxUGmNUBDab8kWSSjSQ72tA4OEk';

    public function __construct(private PasswordHasherFactoryInterface $passwordHasherFactory)
    {
    }

    public function hash(#[SensitiveParameter] string $plain): string
    {
        return $this->passwordHasherFactory
            ->getPasswordHasher(User::class)
            ->hash(PasswordPolicy::normalise($plain));
    }

    /**
     * Not dead code. Sign-in calls this on an unknown address so a miss costs
     * what a hit costs; without it the miss is measurably faster.
     */
    public function verifyAgainstNothing(#[SensitiveParameter] string $plain): void
    {
        $this->passwordHasherFactory
            ->getPasswordHasher(User::class)
            ->verify(self::DUMMY_HASH, PasswordPolicy::normalise($plain));
    }

    public function verify(User $user, #[SensitiveParameter] string $plain): bool
    {
        $hash = $user->getPassword();

        if (null === $hash) {
            return false;
        }

        return $this->passwordHasherFactory
            ->getPasswordHasher(User::class)
            ->verify($hash, PasswordPolicy::normalise($plain));
    }
}
