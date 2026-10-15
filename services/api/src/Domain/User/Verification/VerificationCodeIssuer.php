<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Model\IssuedVerificationCode;
use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use App\Repository\VerificationChallengeRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psl\Str;

final readonly class VerificationCodeIssuer
{
    public function __construct(
        private VerificationChallengeRepository $verificationChallengeRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function issueFor(EmailAddress $address): IssuedVerificationCode
    {
        foreach ($this->verificationChallengeRepository->findUnrevokedFor($address) as $live) {
            $live->setRevokedAt(new DateTimeImmutable());
        }

        $code = self::generate();

        $challenge = new VerificationChallenge(
            $address,
            self::hash($code),
            new DateTimeImmutable(Str\format('+%d minutes', VerificationChallenge::LIFETIME_MINUTES)),
        );

        $this->entityManager->persist($challenge);

        return new IssuedVerificationCode($code, $challenge);
    }

    public static function hash(string $code): string
    {
        return \hash('sha256', $code);
    }

    private static function generate(): string
    {
        $digits = Str\repeat('0', VerificationChallenge::CODE_LENGTH);

        return Str\pad_left(
            (string) SecureRandom\int(0, (int) Str\repeat('9', VerificationChallenge::CODE_LENGTH)),
            Str\length($digits),
            '0',
        );
    }
}
