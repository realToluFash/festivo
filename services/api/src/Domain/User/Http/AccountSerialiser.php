<?php

declare(strict_types=1);

namespace App\Domain\User\Http;

use App\Domain\Messaging\EmailSuppressions;
use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\Http\JoinRequestSerialiser;
use App\Domain\User\Onboarding\AccountCompleteness;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Repository\MembershipRepository;
use App\Repository\ProviderIdentityRepository;
use Psl\Iter;
use Psl\Vec;

final readonly class AccountSerialiser
{
    public function __construct(
        private AccountCompleteness $accountCompleteness,
        private ProviderIdentityRepository $providerIdentityRepository,
        private MembershipRepository $membershipRepository,
        private JoinOfferFinder $joinOfferFinder,
        private JoinRequestSerialiser $joinRequestSerialiser,
        private EmailSuppressions $emailSuppressions,
    ) {
    }

    /** @return array<string, mixed> */
    public function serialise(User $user): array
    {
        $memberships = $this->membershipRepository->findActiveFor($user);
        $pending = [] === $memberships ? $this->joinOfferFinder->pendingRequestFor($user) : null;
        $emails = $user->getEmailAddresses();
        $suppressed = $this->emailSuppressions->suppressedAmong(Vec\map($emails, static fn (EmailAddress $address): string => $address->getAddress()));

        return [
            'id' => $user->getId()->toRfc4122(),
            'name' => $user->getName(),
            'businessName' => $user->getBusinessName(),
            'countryCode' => $user->getCountryCode(),
            // Read here because "A few details" is behind the gate /api/orgs sits behind: an invited person's phone starts on it.
            'organisationCountry' => ($memberships[0] ?? null)?->getOrganisation()->getCountryCode(),
            'locale' => $user->storedLanguage(),
            'timezone' => $user->getTimezone(),
            'colourScheme' => $user->getColourScheme()?->value,
            'twoFactorSetupPrompt' => $user->hasTwoFactorSetupPrompt(),
            'verified' => $user->isVerified(),
            'complete' => $this->accountCompleteness->isComplete($user),
            'hasPassword' => null !== $user->getPassword(),
            'needsOrganisation' => $this->accountCompleteness->needsOrganisation($user),
            // In no organisation and asked to join one (sc-561): the details screen says whom it is waiting for.
            'waitingFor' => null === $pending ? null : $this->joinRequestSerialiser->request($pending),
            // Only ever the person's own: nobody else in an organisation learns whether their mail bounced (sc-44949).
            'emailAddresses' => Vec\map($emails, static fn (EmailAddress $address): array => [
                'id' => $address->getId()->toRfc4122(),
                'address' => $address->getAddress(),
                'verified' => $address->isVerified(),
                'primary' => $address->isPrimary(),
                'undeliverable' => Iter\contains($suppressed, $address->getAddress()),
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
