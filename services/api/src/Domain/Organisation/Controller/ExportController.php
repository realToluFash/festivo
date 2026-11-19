<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Export\OrganisationExports;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\OrganisationExport;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\OrganisationExportStatus;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationExportRepository;
use App\Repository\OrganisationRepository;
use DateTimeImmutable;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Data and control › Export all data (sc-612): where the last export stands, asking for one, and its one download. */
final readonly class ExportController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private OrganisationExportRepository $organisationExportRepository,
        private OrganisationExports $organisationExports,
        private OwnerCheck $ownerCheck,
        private UserMailer $userMailer,
        private ClockInterface $clock,
    ) {
    }

    /** An Owner or an Admin reads it; a Member has no Data and control. */
    #[Route('/api/orgs/{organisationId}/export', name: 'orgs_export', methods: ['GET'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function show(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);

        return new JsonResponse($this->state($organisation, $this->user()));
    }

    /** Refused `owner_required` for an Admin or a Member, and 429 with `Retry-After` while the daily limit holds. */
    #[Route('/api/orgs/{organisationId}/export', name: 'orgs_export_ask', methods: ['POST'])]
    #[InOrganisation(null)]
    public function ask(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $user = $this->user();
        $this->organisationExports->ask($organisation, $user, $request->getLocale());

        return new JsonResponse($this->state($organisation, $user), Response::HTTP_ACCEPTED);
    }

    /** The archive, once, for the Owner who asked; anyone else gets 404, and a used or ended download 410. */
    #[Route('/api/orgs/{organisationId}/export/{exportId}/download', name: 'orgs_export_download', methods: ['POST'])]
    #[InOrganisation(null)]
    public function download(string $organisationId, string $exportId): Response
    {
        $archive = $this->organisationExports->download($this->organisation($organisationId), $exportId, $this->user());

        return new Response($archive->bytes, Response::HTTP_OK, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $archive->name, 'export.zip'),
            'Cache-Control' => 'no-store',
        ]);
    }

    /** @return array<string, mixed> */
    private function state(Organisation $organisation, User $user): array
    {
        $latest = $this->organisationExportRepository->findLatestIn($organisation);
        $next = $this->organisationExportRepository->findLatestCountedIn($organisation)?->nextAllowedAt();
        $next = null !== $next && $next > $this->clock->now() ? $next : null;

        return [
            'owner' => $this->ownerCheck->holds($organisation, $user),
            'export' => null === $latest ? null : $this->export($latest, $user),
            'nextAllowedAt' => $next?->format(\DATE_ATOM),
            'nextAllowed' => null === $next ? null : $this->written(ApiException::statedMinute($next), $user),
        ];
    }

    /** @return array<string, mixed> */
    private function export(OrganisationExport $export, User $user): array
    {
        $expiresAt = $export->expiresAt();
        $downloadedAt = $export->getDownloadedAt();

        return [
            'id' => $export->getId()->toRfc4122(),
            'state' => $this->stateOf($export),
            'mine' => $export->isAskedBy($user),
            'askedBy' => $export->getAskedBy()->getName(),
            'askedAt' => $export->getAskedAt()->format(\DATE_ATOM),
            'asked' => $this->written($export->getAskedAt(), $user),
            'expiresAt' => $expiresAt?->format(\DATE_ATOM),
            'expires' => null === $expiresAt ? null : $this->written($expiresAt, $user),
            'downloadedAt' => $downloadedAt?->format(\DATE_ATOM),
            'downloaded' => null === $downloadedAt ? null : $this->written($downloadedAt, $user),
        ];
    }

    /** @return 'preparing'|'ready'|'used'|'expired'|'failed' */
    private function stateOf(OrganisationExport $export): string
    {
        $expiresAt = $export->expiresAt();

        return match (true) {
            OrganisationExportStatus::Preparing === $export->getStatus() => 'preparing',
            OrganisationExportStatus::Failed === $export->getStatus() => 'failed',
            null !== $export->getDownloadedAt() => 'used',
            null !== $expiresAt && $this->clock->now() >= $expiresAt => 'expired',
            default => 'ready',
        };
    }

    private function written(DateTimeImmutable $at, User $user): string
    {
        return $this->userMailer->deadline($at, $user, $this->userMailer->formattingLocaleFor($user));
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
