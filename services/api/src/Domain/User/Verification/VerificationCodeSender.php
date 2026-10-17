<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Model\IssuedVerificationCode;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;

/** A code goes where the contact is: an email to an address, a phone's by WhatsApp or SMS (sc-750). */
final readonly class VerificationCodeSender
{
    public function __construct(
        private VerificationCodeMailer $verificationCodeMailer,
        private PhoneCodeDispatch $phoneCodeDispatch,
    ) {
    }

    public function send(EmailAddress|PhoneNumber $contact, IssuedVerificationCode $issued): void
    {
        $contact instanceof EmailAddress
            ? $this->verificationCodeMailer->send($contact, $issued->code)
            : $this->phoneCodeDispatch->send($contact, $issued);
    }
}
