<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\OpenApi\Model\Operation;
use ApiPlatform\OpenApi\Model\Parameter;
use App\Enum\Permission;
use App\Enum\VendorCategory;
use App\Http\Access\Policy\InOrganisation;

/** Settings › Vendors (sc-82): a page of the directory, and the counts its card and menus show, which are the whole view's whatever is searched. */
#[ApiResource(
    operations: [
        new GetCollection(
            uriTemplate: '/orgs/{organisationId}/vendors',
            uriVariables: ['organisationId'],
            name: 'orgs_vendors',
            paginationItemsPerPage: VendorDirectory::PAGE,
            paginationClientItemsPerPage: false,
            openapi: new Operation(parameters: [
                new Parameter('view', 'query', 'inUse, the default, or archived', schema: ['type' => 'string', 'enum' => ['inUse', 'archived']]),
                new Parameter('q', 'query', 'A name containing this, ignoring case', schema: ['type' => 'string']),
                new Parameter('category', 'query', 'One of the nine', schema: ['type' => 'string', 'enum' => VendorCategory::VALUES]),
            ]),
            provider: VendorDirectoryProvider::class,
        ),
    ],
)]
#[InOrganisation(Permission::VendorsRead)]
final readonly class VendorDirectory
{
    public const int PAGE = 25;

    /**
     * @param list<array<string, mixed>> $vendors    VendorSerialiser's rows
     * @param array<string, int>         $categories every category's count within the view, in the nine's order
     */
    public function __construct(
        public array $vendors,
        public int $page,
        public int $total,
        public int $inUse,
        public int $archived,
        public array $categories,
    ) {
    }
}
