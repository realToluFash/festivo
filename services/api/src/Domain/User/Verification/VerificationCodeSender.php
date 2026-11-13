<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Model\IssuedVerificationCode;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use Doctrine\ORM\EntityManagerInterface;

/** A code goes where the contact is: an email to an address, a phone's by WhatsApp or SMS (sc-750). */
final readonly class VerificationCodeSender
{
    public function __construct(
        private VerificationCodeIssuer $verificationCodeIssuer,
        private VerificationCodeMailer $verificationCodeMailer,
        private PhoneCodeDispatch $phoneCodeDispatch,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** An address's code and its email commit together; a phone's is sent once its code is stored, since the send is a call out. */
    public function issue(EmailAddress|PhoneNumber $contact): void
    {
        if ($contact instanceof EmailAddress) {
            $this->verificationCodeMailer->issue($contact);

            return;
        }

        $issued = $this->verificationCodeIssuer->issueFor($contact);
        $this->entityManager->flush();
        $this->phoneCodeDispatch->send($contact, $issued);
    }

    public function send(EmailAddress|PhoneNumber $contact, IssuedVerificationCode $issued): void
    {
        $contact instanceof EmailAddress
            ? $this->verificationCodeMailer->send($contact, $issued->code)
            : $this->phoneCodeDispatch->send($contact, $issued);
    }
}
