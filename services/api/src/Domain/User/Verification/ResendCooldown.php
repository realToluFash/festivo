<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Entity\EmailAddress;
use App\Entity\VerificationChallenge;
use App\Repository\VerificationChallengeRepository;
use DateTimeImmutable;
use Psl\Math;

/** Counted from the newest code sent, so every send starts it, the registration email included. */
final readonly class ResendCooldown
{
    public function __construct(
        private VerificationChallengeRepository $verificationChallengeRepository,
    ) {
    }

    public function secondsLeftFor(EmailAddress $address): int
    {
        if ($address->isVerified()) {
            return 0;
        }

        $newest = $this->verificationChallengeRepository->findNewestFor($address);

        if (null === $newest) {
            return 0;
        }

        $ends = $newest->getCreatedAt()->getTimestamp() + VerificationChallenge::RESEND_COOLDOWN_SECONDS;

        return Math\maxva(0, $ends - new DateTimeImmutable()->getTimestamp());
    }
}
