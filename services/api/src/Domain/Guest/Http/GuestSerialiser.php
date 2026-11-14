<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Locale\GuestLanguage;
use App\Locale\SupportedLocales;
use App\Repository\GuestRepository;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** An event's guest list, each companion under their host; the clients sort it by name (sc-1468). Without `contacts` the contact and language keys are left out, not sent empty: Language goes with the contact details (sc-3790). */
final readonly class GuestSerialiser
{
    public function __construct(
        private GuestRepository $guestRepository,
    ) {
    }

    /** @return array{guests: list<array<string, mixed>>, counts: array{people: int, guests: int, companions: int}} */
    public function list(Event $event, bool $contacts): array
    {
        $everybody = $this->guestRepository->findOnList($event);
        $hosts = Vec\filter($everybody, static fn (Guest $guest): bool => null === $guest->getHost());
        $companions = Dict\group_by(
            Vec\filter($everybody, static fn (Guest $guest): bool => null !== $guest->getHost()),
            static fn (Guest $companion): string => $companion->getHost()?->getId()->toRfc4122() ?? '',
        );

        return [
            'guests' => Vec\map($hosts, static fn (Guest $host): array => self::guest($host, $companions[$host->getId()->toRfc4122()] ?? [], $contacts)),
            'counts' => [
                'people' => Iter\count($everybody),
                'guests' => Iter\count($hosts),
                'companions' => Iter\count($everybody) - Iter\count($hosts),
            ],
        ];
    }

    /**
     * @param list<Guest> $companions
     *
     * @return array<string, mixed>
     */
    public static function guest(Guest $host, array $companions, bool $contacts): array
    {
        $reply = $host->getReply() ?? GuestReply::NoReply;
        $zone = new DateTimeZone($host->getEvent()->getTimeZone());
        $invitedAt = $host->getInvitedAt();

        return [
            'id' => $host->getId()->toRfc4122(),
            'fullName' => $host->getFullName(),
            ...$contacts ? [
                'email' => $host->getEmail(),
                'mobile' => $host->getMobile(),
                'language' => $host->getLanguage(),
                'chosenLanguage' => $host->getChosenLanguage(),
                'messageLanguage' => GuestLanguage::forMessage($host),
            ] : [],
            'reply' => $reply->value,
            'repliedAt' => GuestReply::NoReply === $reply ? null : $host->getRepliedAt()?->setTimezone($zone)->format(\DATE_ATOM),
            'replySource' => GuestReply::NoReply === $reply ? null : $host->getReplySource()?->value,
            'invitation' => null === $invitedAt ? null : [
                'at' => $invitedAt->setTimezone($zone)->format(\DATE_ATOM),
                'how' => $host->getInvitationMethod()?->value,
                'by' => $host->getInvitedBy()?->getName(),
            ],
            'companions' => Vec\map($companions, static fn (Guest $companion): array => [
                'id' => $companion->getId()->toRfc4122(),
                'fullName' => $companion->getFullName(),
                'state' => self::companionState(GuestStanding::of($reply, companion: true, invited: $host->isInvited(), notComingByGuest: $companion->isNotComingByGuest())),
                'namedByGuest' => $companion->isNamedByGuest(),
            ]),
        ];
    }

    /** @return 'notYetInvited'|'held'|'coming'|'notComing' */
    public static function companionState(GuestStanding $standing): string
    {
        return match (true) {
            GuestStanding::NotYetInvited === $standing => 'notYetInvited',
            $standing->isHeld() => 'held',
            GuestStanding::Declined === $standing => 'notComing',
            default => 'coming',
        };
    }

    /** @return array<string, mixed> */
    public function details(Guest $host, bool $contacts): array
    {
        return [
            ...self::guest($host, $this->guestRepository->findCompanionsOf($host), $contacts),
            ...$contacts ? ['organisationLanguage' => SupportedLocales::narrow($host->getEvent()->getOrganisation()->getLocale())] : [],
            'added' => [
                'at' => $host->getCreatedAt()->format(\DATE_ATOM),
                'by' => $host->getAddedBy()?->getName(),
            ],
        ];
    }
}
