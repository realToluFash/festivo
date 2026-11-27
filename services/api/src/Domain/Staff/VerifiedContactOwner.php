<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Entity\User;
use App\Repository\EmailAddressRepository;
use App\Repository\PhoneNumberRepository;

/** The one person a roster entry is: whoever has verified its mobile number, else whoever has verified its email. */
final readonly class VerifiedContactOwner
{
    public function __construct(
        private PhoneNumberRepository $phoneNumberRepository,
        private EmailAddressRepository $emailAddressRepository,
    ) {
    }

    public function of(?string $mobile, ?string $email): ?User
    {
        $byPhone = null === $mobile || '' === $mobile ? null : $this->phoneNumberRepository->findOneByNumber($mobile);
        if (null !== $byPhone && $byPhone->isVerified()) {
            return $byPhone->getUser();
        }

        $byEmail = null === $email || '' === $email ? null : $this->emailAddressRepository->findOneByAddress($email);

        return null !== $byEmail && $byEmail->isVerified() ? $byEmail->getUser() : null;
    }
}
