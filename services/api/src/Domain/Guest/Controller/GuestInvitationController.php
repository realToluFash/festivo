<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Http\GuestSerialiser;
use App\Domain\Guest\Invitation\GuestInvitations;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\GuestInvitationMethod;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\EntityTag;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Iter;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Mark as invited and Mark as not invited (sc-3788); each answers the guest's details as they now stand. */
final readonly class GuestInvitationController
{
    public function __construct(
        private Security $security,
        private GuestInvitations $guestInvitations,
        private GuestSerialiser $guestSerialiser,
        private TranslatorInterface $translator,
    ) {
    }

    /** Refused 422 without one of the five ways, and 409 `event_state_invalid` unless the event's phase allows `invite`. */
    #[Route('/api/events/{eventId}/guests/{guestId}/invitation', name: 'guests_mark_invited', methods: ['PUT'])]
    #[InEvent(Permission::GuestsManage)]
    public function mark(Request $request, #[InThisEvent('guestId')] Guest $guest): JsonResponse
    {
        $body = Input::body($request, Type\shape(['how' => Type\optional(Type\nullable(Type\string()))]));
        $how = GuestInvitationMethod::tryFrom($body['how'] ?? '');

        if (null === $how || !Iter\contains(GuestInvitationMethod::byHand(), $how)) {
            throw ApiException::validation([[
                'propertyPath' => 'how',
                'message' => $this->translator->trans('validation.guest_invitation_how_required'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $this->guestInvitations->mark($guest, $how, $this->user());

        return $this->details($guest);
    }

    /** In any phase; refused 409 `guest_replied` once they have replied, and `guest_not_marked_by_hand` for Soirely's message. */
    #[Route('/api/events/{eventId}/guests/{guestId}/invitation', name: 'guests_mark_not_invited', methods: ['DELETE'])]
    #[InEvent(Permission::GuestsManage)]
    public function unmark(#[InThisEvent('guestId')] Guest $guest): JsonResponse
    {
        $this->guestInvitations->unmark($guest, $this->user());

        return $this->details($guest);
    }

    private function details(Guest $guest): JsonResponse
    {
        return new JsonResponse(['guest' => $this->guestSerialiser->details($guest, contacts: true)], headers: ['ETag' => EntityTag::of($guest->getVersion())]);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
