<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Entity\User;
use App\Repository\EmailAddressRepository;
use App\Repository\PhoneNumberRepository;

/** Whoever has verified a roster entry's mobile number, then whoever has verified its email: the people the entry can be said to be. */
final readonly class VerifiedContactOwners
{
    public function __construct(
        private PhoneNumberRepository $phoneNumberRepository,
        private EmailAddressRepository $emailAddressRepository,
    ) {
    }

    /** @return list<User> */
    public function of(?string $mobile, ?string $email): array
    {
        $byPhone = null === $mobile || '' === $mobile ? null : $this->phoneNumberRepository->findOneByNumber($mobile);
        $byEmail = null === $email || '' === $email ? null : $this->emailAddressRepository->findOneByAddress($email);

        $owners = [];
        foreach ([$byPhone, $byEmail] as $contact) {
            if (null !== $contact && $contact->isVerified()) {
                $owners[] = $contact->getUser();
            }
        }

        return $owners;
    }
}
