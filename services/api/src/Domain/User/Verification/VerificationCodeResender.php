<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Model\IssuedVerificationCode;
use App\Entity\EmailAddress;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

final readonly class VerificationCodeResender
{
    public function __construct(
        private ResendCooldown $resendCooldown,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The new code, or the seconds before one may be sent (0 once verified), re-read under the row lock. */
    public function resend(EmailAddress $address): IssuedVerificationCode|int
    {
        return $this->entityManager->wrapInTransaction(function () use ($address): IssuedVerificationCode|int {
            $this->entityManager->refresh($address, LockMode::PESSIMISTIC_WRITE);

            if ($address->isVerified()) {
                return 0;
            }

            $left = $this->resendCooldown->secondsLeftFor($address);

            if ($left > 0) {
                return $left;
            }

            $issued = $this->verificationCodeIssuer->issueFor($address);
            $this->entityManager->flush();

            return $issued;
        });
    }
}
