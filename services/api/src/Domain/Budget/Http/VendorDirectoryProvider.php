<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\Pagination\Pagination;
use ApiPlatform\State\ProviderInterface;
use App\Entity\Vendor;
use App\Enum\VendorCategory;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Repository\OrganisationRepository;
use App\Repository\VendorEngagementRepository;
use App\Repository\VendorRepository;
use Psl\Math;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** @implements ProviderInterface<VendorDirectory> */
final readonly class VendorDirectoryProvider implements ProviderInterface
{
    public function __construct(
        private OrganisationRepository $organisationRepository,
        private VendorRepository $vendorRepository,
        private VendorEngagementRepository $engagementRepository,
        private Pagination $pagination,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): VendorDirectory
    {
        $organisationId = $uriVariables['organisationId'] ?? null;
        $organisation = \is_string($organisationId) && Uuid::isValid($organisationId) ? $this->organisationRepository->find($organisationId) : null;

        if (null === $organisation) {
            throw ApiException::notFound('access.not_found');
        }

        $filters = \is_array($context['filters'] ?? null) ? $context['filters'] : [];
        $archived = match ($filters['view'] ?? 'inUse') {
            'inUse' => false,
            'archived' => true,
            default => throw new ShapeRefusal('view'),
        };
        $typed = \is_string($filters['q'] ?? null) ? Str\trim($filters['q']) : '';
        $category = null;

        if (null !== ($filters['category'] ?? null)) {
            $category = \is_string($filters['category']) ? VendorCategory::tryFrom($filters['category']) : null;
            $category ?? throw new ShapeRefusal('category');
        }

        $page = $this->pagination->getPage($context);
        $most = $this->pagination->getLimit($operation, $context);
        $first = $this->pagination->getOffset($operation, $context);
        $landing = \is_string($filters['vendor'] ?? null) ? $this->vendorRepository->findOneInOrganisation($organisation, $filters['vendor']) : null;

        if (null !== $landing && '' === $typed && null === $category && (null !== $landing->getArchivedAt()) === $archived) {
            $page = Math\div($this->vendorRepository->countBefore($organisation, $archived, $landing), $most) + 1;
            $first = ($page - 1) * $most;
        }

        $found = $this->vendorRepository->findPage($organisation, $archived, $typed, $category, $first, $most);
        $counts = $this->vendorRepository->countIn($organisation, $archived);

        $engaging = $this->engagementRepository->countEventsOf(Vec\map($found['vendors'], static fn (Vendor $vendor): Uuid => $vendor->getId()));

        return new VendorDirectory(
            Vec\map($found['vendors'], static fn (Vendor $vendor): array => [...VendorSerialiser::vendor($vendor), 'events' => $engaging[$vendor->getId()->toRfc4122()] ?? 0]),
            $page,
            $found['total'],
            $counts['inUse'],
            $counts['archived'],
            $counts['categories'],
        );
    }
}
