<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Entity\User;
use SensitiveParameter;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactoryInterface;

/**
 * Hashing and verifying must apply the same normalisation or a correct password
 * is refused for one person on one device, with nothing in any log. Both go
 * through here so the two sides cannot disagree.
 */
final readonly class PasswordResolver
{
    public function __construct(private PasswordHasherFactoryInterface $passwordHasherFactory)
    {
    }

    public function hash(#[SensitiveParameter] string $plain): string
    {
        return $this->passwordHasherFactory
            ->getPasswordHasher(User::class)
            ->hash(PasswordPolicy::normalise($plain));
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
