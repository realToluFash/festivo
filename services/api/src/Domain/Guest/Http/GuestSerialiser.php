<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Enum\NeedKind;
use App\Locale\GuestLanguage;
use App\Locale\SupportedLocales;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestRepository;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** An event's guest list, each companion under their host; the clients sort it by name (sc-1468). Without `contacts` the contact, language and needs keys are left out, not sent empty: Language goes with the contact details (sc-3790), needs with guests.manage (sc-3777). */
final readonly class GuestSerialiser
{
    public function __construct(
        private GuestRepository $guestRepository,
        private GuestNeedsRecord $guestNeedsRecord,
        private GuestGroupRepository $guestGroupRepository,
    ) {
    }

    /** @return array{guests: list<array<string, mixed>>, counts: array{people: int, guests: int, companions: int}, groups: list<array{id: string, name: string, counts: array{people: int, guests: int, companions: int}}>, ungrouped: array{people: int, guests: int, companions: int}} */
    public function list(Event $event, bool $contacts): array
    {
        $everybody = $this->guestRepository->findOnList($event);
        $hosts = Vec\filter($everybody, static fn (Guest $guest): bool => null === $guest->getHost());
        $companions = Dict\group_by(
            Vec\filter($everybody, static fn (Guest $guest): bool => null !== $guest->getHost()),
            static fn (Guest $companion): string => $companion->getHost()?->getId()->toRfc4122() ?? '',
        );
        $needs = $contacts ? $this->guestNeedsRecord->of($everybody) : null;
        $countOf = static function (array $those) use ($companions): array {
            $theirs = Iter\reduce($those, static fn (int $sum, Guest $host): int => $sum + Iter\count($companions[$host->getId()->toRfc4122()] ?? []), 0);

            return ['people' => Iter\count($those) + $theirs, 'guests' => Iter\count($those), 'companions' => $theirs];
        };

        return [
            'guests' => Vec\map($hosts, static fn (Guest $host): array => self::guest($host, $companions[$host->getId()->toRfc4122()] ?? [], $needs)),
            'counts' => $countOf($hosts),
            'groups' => Vec\map($this->guestGroupRepository->findOnEvent($event), static fn (GuestGroup $group): array => [
                ...self::group($group),
                'counts' => $countOf(Vec\filter($hosts, static fn (Guest $host): bool => $host->getGroup() === $group)),
            ]),
            'ungrouped' => $countOf(Vec\filter($hosts, static fn (Guest $host): bool => null === $host->getGroup())),
        ];
    }

    /** @return array{id: string, name: string} */
    public static function group(GuestGroup $group): array
    {
        return ['id' => $group->getId()->toRfc4122(), 'name' => $group->getName()];
    }

    /**
     * @param list<Guest>                $companions
     * @param ?array<string, GuestNeeds> $needs      everybody's by id for a reader with guests.manage, null for anyone else
     *
     * @return array<string, mixed>
     */
    private static function guest(Guest $host, array $companions, ?array $needs): array
    {
        $reply = $host->getReply() ?? GuestReply::NoReply;
        $contacts = null !== $needs;
        $needsOf = static fn (Guest $person): array => null === $needs ? [] : ['needs' => self::needs($needs[$person->getId()->toRfc4122()] ?? GuestNeeds::none())];
        $zone = new DateTimeZone($host->getEvent()->getTimeZone());
        $invitedAt = $host->getInvitedAt();
        $group = $host->getGroup();

        return [
            'id' => $host->getId()->toRfc4122(),
            'fullName' => $host->getFullName(),
            'group' => null === $group ? null : self::group($group),
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
            ...$needsOf($host),
            'companions' => Vec\map($companions, static fn (Guest $companion): array => [
                'id' => $companion->getId()->toRfc4122(),
                'fullName' => $companion->getFullName(),
                'state' => self::companionState(GuestStanding::of($reply, companion: true, invited: $host->isInvited(), notComingByGuest: $companion->isNotComingByGuest())),
                'namedByGuest' => $companion->isNamedByGuest(),
                ...$needsOf($companion),
            ]),
        ];
    }

    /** Codes, never words: each client words them in its reader's language (sc-3777). */
    private static function needs(GuestNeeds $needs): array
    {
        return [
            ...Dict\from_entries(Vec\map(NeedKind::cases(), static fn (NeedKind $kind): array => [$kind->field(), $needs->codesOf($kind)])),
            ...Dict\from_entries(Vec\map(NeedKind::cases(), static fn (NeedKind $kind): array => [$kind->otherField(), $needs->otherOf($kind)])),
            'note' => $needs->note,
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
        $companions = $this->guestRepository->findCompanionsOf($host);

        return [
            ...self::guest($host, $companions, $contacts ? $this->guestNeedsRecord->of([$host, ...$companions]) : null),
            ...$contacts ? ['organisationLanguage' => SupportedLocales::narrow($host->getEvent()->getOrganisation()->getLocale())] : [],
            'added' => [
                'at' => $host->getCreatedAt()->format(\DATE_ATOM),
                'by' => $host->getAddedBy()?->getName(),
            ],
        ];
    }
}
