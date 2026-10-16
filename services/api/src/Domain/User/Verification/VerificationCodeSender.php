<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;

/** A code goes where the contact is: an email to an address, a text to a phone. */
final readonly class VerificationCodeSender
{
    public function __construct(
        private VerificationCodeMailer $verificationCodeMailer,
        private VerificationCodeTexter $verificationCodeTexter,
    ) {
    }

    public function send(EmailAddress|PhoneNumber $contact, string $code): void
    {
        $contact instanceof EmailAddress
            ? $this->verificationCodeMailer->send($contact, $code)
            : $this->verificationCodeTexter->send($contact, $code);
    }
}
