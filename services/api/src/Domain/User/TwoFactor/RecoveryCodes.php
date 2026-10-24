<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Entity\RecoveryCode;
use App\Entity\User;
use App\Repository\RecoveryCodeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Regex;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactoryInterface;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

/** Ten 40-bit codes, shown once; under 112 bits, so each is a salted slow hash (NIST SP 800-63B 5.1.2.2). */
final readonly class RecoveryCodes
{
    public const int COUNT = 10;

    private const string ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

    public function __construct(
        private RecoveryCodeRepository $recoveryCodeRepository,
        private PasswordHasherFactoryInterface $passwordHasherFactory,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** @return list<string> the new codes, in the form they are shown; every earlier one stops working */
    public function issueFor(User $user): array
    {
        $this->recoveryCodeRepository->deleteAllFor($user);

        $codes = Vec\map(Vec\range(1, self::COUNT), static function (): string {
            $raw = SecureRandom\string(8, self::ALPHABET);

            return Str\slice($raw, 0, 4) . '-' . Str\slice($raw, 4);
        });

        foreach ($codes as $code) {
            $this->entityManager->persist(new RecoveryCode($user, $this->hasher()->hash(self::normalise($code))));
        }

        return $codes;
    }

    /** The account's code that matches what was typed, used or not; at most ten to try. */
    public function find(User $user, #[SensitiveParameter] string $typed): ?RecoveryCode
    {
        $plain = self::normalise($typed);

        return Iter\search(
            $this->recoveryCodeRepository->findAllFor($user),
            fn (RecoveryCode $code): bool => '' !== $plain && $this->hasher()->verify($code->getCodeHash(), $plain),
        );
    }

    /** Typed with or without the dash, in either case, as it was copied. */
    private static function normalise(#[SensitiveParameter] string $typed): string
    {
        return Regex\replace(Str\lowercase($typed), '/[^a-z0-9]/', '');
    }

    private function hasher(): PasswordHasherInterface
    {
        return $this->passwordHasherFactory->getPasswordHasher(User::class);
    }
}
