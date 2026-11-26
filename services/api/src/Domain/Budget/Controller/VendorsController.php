<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\VendorSerialiser;
use App\Domain\Budget\VendorEditor;
use App\Domain\Budget\VendorRules;
use App\Entity\Organisation;
use App\Entity\Vendor;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationRepository;
use App\Repository\VendorRepository;
use Psl\Type;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Settings › Vendors' writes (sc-82); the directory itself is read through API Platform, `VendorDirectory`. */
#[InOrganisation(Permission::VendorsManage)]
final readonly class VendorsController
{
    public function __construct(
        private OrganisationRepository $organisationRepository,
        private VendorRepository $vendorRepository,
        private VendorRules $vendorRules,
        private VendorEditor $vendorEditor,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/vendors', name: 'orgs_vendors_add', methods: ['POST'])]
    public function add(Request $request, string $organisationId): JsonResponse
    {
        $vendor = $this->vendorEditor->add($this->organisation($organisationId), $this->vendorRules->check(self::typed($request)));

        return new JsonResponse(['vendor' => VendorSerialiser::vendor($vendor)], Response::HTTP_CREATED);
    }

    /** Every field is sent, as the form holds them: a blank optional one is cleared. */
    #[Route('/api/orgs/{organisationId}/vendors/{vendorId}', name: 'orgs_vendors_edit', methods: ['PUT'])]
    public function edit(Request $request, string $organisationId, string $vendorId): JsonResponse
    {
        $vendor = $this->vendor($organisationId, $vendorId);
        $this->vendorEditor->edit($vendor, $this->vendorRules->check(self::typed($request)));

        return new JsonResponse(['vendor' => VendorSerialiser::vendor($vendor)]);
    }

    #[Route('/api/orgs/{organisationId}/vendors/{vendorId}/archive', name: 'orgs_vendors_archive', methods: ['POST'])]
    public function archive(string $organisationId, string $vendorId): JsonResponse
    {
        $vendor = $this->vendor($organisationId, $vendorId);
        $this->vendorEditor->archive($vendor);

        return new JsonResponse(['vendor' => VendorSerialiser::vendor($vendor)]);
    }

    #[Route('/api/orgs/{organisationId}/vendors/{vendorId}/restore', name: 'orgs_vendors_restore', methods: ['POST'])]
    public function restore(string $organisationId, string $vendorId): JsonResponse
    {
        $vendor = $this->vendor($organisationId, $vendorId);
        $this->vendorEditor->restore($vendor);

        return new JsonResponse(['vendor' => VendorSerialiser::vendor($vendor)]);
    }

    /** @return array{name: string, category: string, contactName?: ?string, emailAddress?: ?string, phoneCountryCode?: ?string, phoneNumber?: ?string, website?: ?string, address?: ?string, note?: ?string} */
    private static function typed(Request $request): array
    {
        $optional = Type\optional(Type\nullable(Type\string()));

        return Input::body($request, Type\shape([
            'name' => Type\string(),
            'category' => Type\string(),
            'contactName' => $optional,
            'emailAddress' => $optional,
            'phoneCountryCode' => $optional,
            'phoneNumber' => $optional,
            'website' => $optional,
            'address' => $optional,
            'note' => $optional,
        ]));
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    /** Another organisation's vendor reads as not found, never as forbidden. */
    private function vendor(string $organisationId, string $vendorId): Vendor
    {
        return $this->vendorRepository->findOneInOrganisation($this->organisation($organisationId), $vendorId)
            ?? throw ApiException::notFound('access.not_found');
    }
}
