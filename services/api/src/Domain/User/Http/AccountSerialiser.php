<?php

declare(strict_types=1);

namespace App\Domain\User\Http;

use App\Domain\User\Onboarding\AccountCompleteness;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Repository\ProviderIdentityRepository;
use Psl\Vec;

final readonly class AccountSerialiser
{
    public function __construct(
        private AccountCompleteness $accountCompleteness,
        private ProviderIdentityRepository $providerIdentityRepository,
    ) {
    }

    /** @return array<string, mixed> */
    public function serialise(User $user): array
    {
        return [
            'id' => $user->getId()->toRfc4122(),
            'name' => $user->getName(),
            'businessName' => $user->getBusinessName(),
            'countryCode' => $user->getCountryCode(),
            'locale' => $user->getLocale(),
            'verified' => $user->isVerified(),
            'complete' => $this->accountCompleteness->isComplete($user),
            'hasPassword' => null !== $user->getPassword(),
            'needsOrganisation' => $this->accountCompleteness->needsOrganisation($user),
            'emailAddresses' => Vec\map($user->getEmailAddresses(), static fn (EmailAddress $address): array => [
                'id' => $address->getId()->toRfc4122(),
                'address' => $address->getAddress(),
                'verified' => $address->isVerified(),
                'primary' => $address->isPrimary(),
            ]),
            'phoneNumbers' => Vec\map($user->getPhoneNumbers(), static fn (PhoneNumber $phone): array => [
                'id' => $phone->getId()->toRfc4122(),
                'number' => $phone->getNumber(),
                'countryCode' => $phone->getCountryCode(),
                'verified' => $phone->isVerified(),
                'primary' => $phone->isPrimary(),
                'pending' => $phone->isPending(),
            ]),
            // Which providers vouch for this account, so a screen can say "Google has already confirmed it".
            'providers' => Vec\map(
                $this->providerIdentityRepository->findBy(['user' => $user]),
                static fn (ProviderIdentity $identity): string => $identity->getProvider()->value,
            ),
        ];
    }
}
