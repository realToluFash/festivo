<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Model\IssuedVerificationCode;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

final readonly class VerificationCodeResender
{
    public function __construct(
        private ResendCooldown $resendCooldown,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private VerificationCodeMailer $verificationCodeMailer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The new code, or the seconds before one may be sent (0 once verified), re-read under the row lock. An address's email is queued with it; a phone's is the caller's to send. */
    public function resend(EmailAddress|PhoneNumber $contact): IssuedVerificationCode|int
    {
        return $this->entityManager->wrapInTransaction(function () use ($contact): IssuedVerificationCode|int {
            $this->entityManager->refresh($contact, LockMode::PESSIMISTIC_WRITE);

            if ($contact->isVerified()) {
                return 0;
            }

            $left = $this->resendCooldown->secondsLeftFor($contact);

            if ($left > 0) {
                return $left;
            }

            $issued = $this->verificationCodeIssuer->issueFor($contact);
            $this->entityManager->flush();

            if ($contact instanceof EmailAddress) {
                $this->verificationCodeMailer->send($contact, $issued->code);
            }

            return $issued;
        });
    }
}
