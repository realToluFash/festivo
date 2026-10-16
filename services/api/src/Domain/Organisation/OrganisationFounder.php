<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Str;

/** The step sc-57's details screen calls: a new organisation, its seeded roles, and its founder as Owner. */
final readonly class OrganisationFounder
{
    public function __construct(
        private OrganisationRules $organisationRules,
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
        ]);

        $organisation = new Organisation(
            $fields['name'],
            $fields['countryCode'],
            $fields['currency'],
            $fields['timezone'],
            $fields['contactAddress'],
        );
        $owners = Role::seeded($organisation, SeededRole::Owner);

        $this->entityManager->persist($organisation);
        $this->entityManager->persist($owners);
        $this->entityManager->persist(new Membership($organisation, $owner, $owners, MembershipStatus::Active));

        return $organisation;
    }
}
