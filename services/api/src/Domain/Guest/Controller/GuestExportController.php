<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Export\GuestExporter;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\GuestExportFormat;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Export (sc-3784): the guests and companions the host is looking at, as .xlsx or .csv, the needs columns only with guests.manage. */
final readonly class GuestExportController
{
    /** Only the grants that edit the event take a copy; Owner and Admin hold no event role, and any other level is refused until decided (Decided, 1 Nov). */
    private const array EXPORTS = [null, EventRole::Lead, EventRole::CanEdit];

    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private GuestExporter $guestExporter,
    ) {
    }

    /** `people` names who is in the file, in its order; refused 403 for every event role but Lead and Can edit. */
    #[Route('/api/events/{eventId}/guests/export', name: 'guests_export', methods: ['POST'])]
    #[InEvent(Permission::GuestsRead)]
    public function export(Request $request, string $eventId): Response
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');
        $user = $this->user();
        $grants = $this->membershipDirectory->grantsOnEvent($user, $event->getOrganisation()->getId(), $event->getId());
        if (null === $grants || !Iter\contains(self::EXPORTS, $grants->eventRole())) {
            throw ApiException::permissionRequired(Permission::GuestsManage);
        }

        $body = Input::body($request, Type\shape([
            'format' => Type\backed_enum(GuestExportFormat::class),
            'scope' => Type\union(Type\literal_scalar('view'), Type\literal_scalar('all')),
            'people' => Type\vec(Type\string()),
        ]));
        $file = $this->guestExporter->export($event, $body['people'], $body['format'], $grants->allows(Permission::GuestsManage), $body['scope'], $user);

        return new Response($file->content, Response::HTTP_OK, [
            'Content-Type' => $file->format->contentType(),
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $file->name, 'guests.' . $file->format->value),
            'Cache-Control' => 'no-store',
        ]);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
