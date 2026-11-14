<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Access;

use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

/** Routes that exist only in the suite, so the access layer is proved before any real resource uses it. */
#[AsController]
final class AccessFixtureController
{
    #[Route('/api/_access/organisations/{organisationId}', name: 'access_fixture_organisation', methods: ['GET'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function organisation(): JsonResponse
    {
        return new JsonResponse(['reached' => true]);
    }

    #[Route('/api/_access/events/{eventId}/tables/{tableId}', name: 'access_fixture_table', methods: ['GET'])]
    #[InEvent(Permission::OrganisationManage)]
    public function table(#[InThisEvent('tableId')] FixtureTable $table): JsonResponse
    {
        return new JsonResponse(['table' => $table->id->toRfc4122()]);
    }
}
