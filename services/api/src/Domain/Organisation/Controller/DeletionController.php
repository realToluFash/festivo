<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Deletion\OrganisationDeleter;
use App\Domain\Organisation\Deletion\OrganisationHoldings;
use App\Domain\Organisation\Deletion\RestoreWindow;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationRepository;
use DateTimeImmutable;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Settings > Organisation's delete (sc-68): what it destroys and until when support can undo it, then the deletion. */
final readonly class DeletionController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private OrganisationDeleter $organisationDeleter,
        private OrganisationHoldings $organisationHoldings,
        private UserMailer $userMailer,
        private ClockInterface $clock,
    ) {
    }

    /** The deadline a deletion sent now would get, written in the caller's zone. */
    #[Route('/api/orgs/{organisationId}/deletion', name: 'orgs_deletion', methods: ['GET'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function preview(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->organisationDeleter->ownerOf($organisation, $this->user());

        return new JsonResponse([
            ...$this->organisationHoldings->of($organisation),
            ...$this->window(RestoreWindow::toTheSecond($this->clock->now()), $request),
        ]);
    }

    #[Route('/api/orgs/{organisationId}', name: 'orgs_delete', methods: ['DELETE'])]
    #[InOrganisation(Permission::OrganisationManage)]
    public function delete(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape(['name' => Type\string()]));
        $at = $this->organisationDeleter->delete($organisation, $this->user(), $body['name'], $request->getLocale());

        return new JsonResponse(['deletedAt' => $at->format(\DATE_ATOM), ...$this->window($at, $request)]);
    }

    /** @return array{restoreClosesAt: string, restoreCloses: string} */
    private function window(DateTimeImmutable $deletedAt, Request $request): array
    {
        $closes = RestoreWindow::closesAt($deletedAt);
        $user = $this->user();

        return [
            'restoreClosesAt' => $closes->format(\DATE_ATOM),
            'restoreCloses' => $this->userMailer->deadline($closes, $user, $this->userMailer->localeFor($user, $request->getLocale())),
        ];
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('Not found.');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
