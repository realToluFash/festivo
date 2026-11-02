<?php

declare(strict_types=1);

namespace App\Domain\User\Http;

use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\Http\JoinRequestSerialiser;
use App\Domain\User\Onboarding\AccountCompleteness;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Repository\MembershipRepository;
use App\Repository\ProviderIdentityRepository;
use Psl\Vec;

final readonly class AccountSerialiser
{
    public function __construct(
        private AccountCompleteness $accountCompleteness,
        private ProviderIdentityRepository $providerIdentityRepository,
        private MembershipRepository $membershipRepository,
        private JoinOfferFinder $joinOfferFinder,
        private JoinRequestSerialiser $joinRequestSerialiser,
    ) {
    }

    /** @return array<string, mixed> */
    public function serialise(User $user): array
    {
        $memberships = $this->membershipRepository->findActiveFor($user);
        $pending = [] === $memberships ? $this->joinOfferFinder->pendingRequestFor($user) : null;

        return [
            'id' => $user->getId()->toRfc4122(),
            'name' => $user->getName(),
            'businessName' => $user->getBusinessName(),
            'countryCode' => $user->getCountryCode(),
            // Read here because "A few details" is behind the gate /api/orgs sits behind: an invited person's phone starts on it.
            'organisationCountry' => ($memberships[0] ?? null)?->getOrganisation()->getCountryCode(),
            'locale' => $user->storedLanguage(),
            'timezone' => $user->getTimezone(),
            'twoFactorSetupPrompt' => $user->hasTwoFactorSetupPrompt(),
            'verified' => $user->isVerified(),
            'complete' => $this->accountCompleteness->isComplete($user),
            'hasPassword' => null !== $user->getPassword(),
            'needsOrganisation' => $this->accountCompleteness->needsOrganisation($user),
            // In no organisation and asked to join one (sc-561): the details screen says whom it is waiting for.
            'waitingFor' => null === $pending ? null : $this->joinRequestSerialiser->request($pending),
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
            // Which providers vouch for this account, and as which address: the details screen and Security's ways to sign in.
            'providers' => Vec\map(
                $this->providerIdentityRepository->findBy(['user' => $user]),
                static fn (ProviderIdentity $identity): array => ['provider' => $identity->getProvider()->value, 'email' => $identity->getEmail()],
            ),
        ];
    }
}
