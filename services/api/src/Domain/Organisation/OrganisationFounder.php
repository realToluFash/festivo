<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\User\Mail\AccountLanguage;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Str;
use Psl\Vec;

/** The step sc-57's details screen calls: a new organisation, its seeded roles, and its founder as Owner. */
final readonly class OrganisationFounder
{
    public function __construct(
        private OrganisationRules $organisationRules,
        private MembershipMachine $membershipMachine,
        private AccountLanguage $accountLanguage,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** Currency follows the country, the timezone is the device's, the contact address is the owner's. */
    public function found(User $owner, string $name, string $countryCode, string $timezone): Organisation
    {
        $contact = $owner->getPrimaryEmailAddress()?->getAddress()
            ?? throw new LogicException('An account with no primary address cannot found an organisation.');

        $country = Str\uppercase(Str\trim($countryCode));

        $fields = $this->organisationRules->check([
            'name' => $name,
            'countryCode' => $country,
            'currency' => Regions::isCountry($country) ? Regions::currencyOf($country) : '',
            'timezone' => $timezone,
            'contactAddress' => $contact,
            'locale' => $this->accountLanguage->of($owner),
        ]);

        $organisation = new Organisation(
            $fields['name'],
            $fields['countryCode'],
            $fields['currency'],
            $fields['timezone'],
            $fields['contactAddress'],
            $fields['locale'],
        );
        $this->entityManager->persist($organisation);
        $roles = Vec\map(SeededRole::cases(), static fn (SeededRole $seeded): Role => Role::seeded($organisation, $seeded));

        foreach ($roles as $role) {
            $this->entityManager->persist($role);
        }

        $this->membershipMachine->join($organisation, $owner, $roles[0], MembershipStatus::Active, MembershipChannel::SelfCreated, $owner);

        return $organisation;
    }
}
