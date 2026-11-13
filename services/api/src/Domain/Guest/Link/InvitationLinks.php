<?php

declare(strict_types=1);

namespace App\Domain\Guest\Link;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventAction;
use App\Enum\EventPhase;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Encoding\Base64;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** One current link per guest (sc-1526): issued when they are added, copied only while the event may invite, replaced at any time. */
final readonly class InvitationLinks
{
    public const string REPLACED = 'guest.link_replaced';

    public const string FLAGGED = 'guest.link_flagged';

    public const string PATH = '/i/';

    public function __construct(
        private string $webOrigin,
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    /** 256 bits from the system's secure source, base64url without padding: 43 characters, nothing taken from the guest or the event. */
    public static function token(): string
    {
        return Base64\encode(SecureRandom\bytes(32), Base64\Variant::UrlSafe, padding: false);
    }

    /** A companion has no link of their own: the same 404 as a guest who does not exist. */
    public function linked(Guest $guest): Guest
    {
        return null === $guest->getHost() ? $guest : throw ApiException::notFound('access.not_found');
    }

    /** Refused 409 `event_state_invalid` unless the event's phase allows `invite`. */
    public function linkOf(Guest $guest): string
    {
        $event = $guest->getEvent();
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now());

        if (!$phase->allows(EventAction::Invite)) {
            throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: ['phase' => $phase->value]);
        }

        return $this->url($guest);
    }

    /** Never limited by the phase: ending a link that has leaked is always possible. The audit holds who and when, never the token. */
    public function replace(Guest $guest, User $by): void
    {
        $guest->replaceLink(self::token());
        $this->auditor->record(self::REPLACED, 'Guest', $guest->getId(), Actor::User, $by->getId(), $by->getName());
        $this->entityManager->flush();
    }

    /** The guest a token opens: null for an unknown or replaced token and for a deleted event's, so all three answer alike. */
    public function guestFor(#[SensitiveParameter] string $token): ?Guest
    {
        return '' === $token ? null : $this->guestRepository->findOneByLink($token);
    }

    /** One flag per guest until a replace clears it; a second tell changes nothing. */
    public function flag(Guest $guest): void
    {
        if ($guest->isLinkFlagged()) {
            return;
        }

        $guest->flagLink();
        $this->auditor->record(self::FLAGGED, 'Guest', $guest->getId());
        $this->entityManager->flush();
    }

    /** @return list<string> */
    public function flaggedOn(Event $event): array
    {
        return Vec\map($this->guestRepository->findFlagged($event), static fn (Guest $guest): string => $guest->getId()->toRfc4122());
    }

    private function url(Guest $guest): string
    {
        return Str\trim_right($this->webOrigin, '/') . self::PATH . ($guest->getLinkToken() ?? throw ApiException::notFound('access.not_found'));
    }
}
