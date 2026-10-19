<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Http\OrganisationSerialiser;
use App\Domain\Organisation\OrganisationRules;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\Permission;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\MembershipRepository;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class OrganisationController
{
    public function __construct(
        private Security $security,
        private MembershipRepository $membershipRepository,
        private OrganisationRepository $organisationRepository,
        private OrganisationRules $organisationRules,
        private EntityManagerInterface $entityManager,
        private MembershipDirectoryInterface $membershipDirectory,
    ) {
    }

    /** Each organisation the caller is an active member of, with their role in it. */
    #[Route('/api/orgs', name: 'orgs_list', methods: ['GET'])]
    #[Authenticated]
    public function list(): JsonResponse
    {
        $user = $this->security->getUser();
        $memberships = $user instanceof User ? $this->membershipRepository->findActiveFor($user) : [];

        return new JsonResponse([
            'organisations' => Vec\map($memberships, fn (Membership $membership): array => OrganisationSerialiser::membership(
                $membership,
                $this->membershipDirectory->grantsIn($membership->getUser(), $membership->getOrganisation()->getId()) ?? Grants::only([]),
            )),
        ]);
    }

    /** Any of the six fields; those left out keep their value. */
    #[Route('/api/orgs/{organisationId}', name: 'orgs_update', methods: ['PATCH'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function update(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisationRepository->find($organisationId)
            ?? throw ApiException::notFound('Not found.');

        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\string()),
            'countryCode' => Type\optional(Type\string()),
            'currency' => Type\optional(Type\string()),
            'timezone' => Type\optional(Type\string()),
            'contactAddress' => Type\optional(Type\string()),
            'locale' => Type\optional(Type\string()),
        ]));

        $fields = $this->organisationRules->check([
            'name' => $body['name'] ?? $organisation->getName(),
            'countryCode' => $body['countryCode'] ?? $organisation->getCountryCode(),
            'currency' => $body['currency'] ?? $organisation->getCurrency(),
            'timezone' => $body['timezone'] ?? $organisation->getTimezone(),
            'contactAddress' => $body['contactAddress'] ?? $organisation->getContactAddress(),
            'locale' => $body['locale'] ?? $organisation->getLocale(),
        ]);

        $organisation->setName($fields['name']);
        $organisation->setCountryCode($fields['countryCode']);
        $organisation->setCurrency($fields['currency']);
        $organisation->setTimezone($fields['timezone']);
        $organisation->setContactAddress($fields['contactAddress']);
        $organisation->setLocale($fields['locale']);
        $this->entityManager->flush();

        return new JsonResponse(OrganisationSerialiser::organisation($organisation));
    }
}
