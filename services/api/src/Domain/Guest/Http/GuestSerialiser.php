<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Messaging\GuestMessages\GuestSuppressions;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Entity\MealAnswer;
use App\Entity\SeatAssignment;
use App\Entity\SeatingRow;
use App\Entity\SeatingTable;
use App\Enum\GuestChannel;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Enum\MealAnswerKind;
use App\Enum\NeedKind;
use App\Locale\GuestLanguage;
use App\Locale\SupportedLocales;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestRepository;
use App\Repository\MealAnswerRepository;
use App\Repository\SeatAssignmentRepository;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** An event's guest list, each companion under their host; the clients sort it by name (sc-1468). Without `contacts` the contact, language and needs keys are left out, not sent empty: Language goes with the contact details (sc-3790), needs with guests.manage (sc-3777), and so do the opt-outs (sc-3969). */
final readonly class GuestSerialiser
{
    public function __construct(
        private GuestRepository $guestRepository,
        private GuestNeedsRecord $guestNeedsRecord,
        private GuestGroupRepository $guestGroupRepository,
        private SeatAssignmentRepository $seatAssignmentRepository,
        private MealAnswerRepository $mealAnswerRepository,
        private GuestSuppressions $guestSuppressions,
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
        $everyCompanion = Vec\filter($everybody, static fn (Guest $guest): bool => null !== $guest->getHost());
        $seats = $this->seatsOf($everyCompanion);
        $meals = $this->mealsOf($everyCompanion);
        $countOf = static function (array $those) use ($companions): array {
            $theirs = Iter\reduce($those, static fn (int $sum, Guest $host): int => $sum + Iter\count($companions[$host->getId()->toRfc4122()] ?? []), 0);

            return ['people' => Iter\count($those) + $theirs, 'guests' => Iter\count($those), 'companions' => $theirs];
        };

        return [
            'guests' => Vec\map($hosts, static fn (Guest $host): array => self::guest($host, $companions[$host->getId()->toRfc4122()] ?? [], $needs, $seats, $meals)),
            'counts' => $countOf($hosts),
            'groups' => Vec\map($this->guestGroupRepository->findOnEvent($event), static fn (GuestGroup $group): array => [
                ...self::group($group),
                'counts' => $countOf(Vec\filter($hosts, static fn (Guest $host): bool => $host->getGroup() === $group)),
            ]),
            'ungrouped' => $countOf(Vec\filter($hosts, static fn (Guest $host): bool => null === $host->getGroup())),
        ];
    }

    /**
     * @param list<Guest> $companions
     *
     * @return array<string, array{kind: string, name: string}>
     */
    private function seatsOf(array $companions): array
    {
        return Dict\from_entries(Vec\map(
            $this->seatAssignmentRepository->findOfGuests($companions),
            static fn (SeatAssignment $assignment): array => [$assignment->getGuest()->getId()->toRfc4122(), self::seat($assignment)],
        ));
    }

    /**
     * Where a companion sits, so removing them asks first (sc-4013): a row by its label, which each client words.
     *
     * @return array{kind: string, name: string}
     */
    private static function seat(SeatAssignment $assignment): array
    {
        $place = $assignment->getPlace();

        return match (true) {
            $place instanceof SeatingTable => ['kind' => 'table', 'name' => $place->getName()],
            $place instanceof SeatingRow => ['kind' => 'row', 'name' => $place->getLabel()],
            default => ['kind' => 'seat', 'name' => $place->getName()],
        };
    }

    /**
     * The companions with a meal chosen, so removing them asks first (sc-3907): any answer stored but skipped.
     *
     * @param list<Guest> $companions
     *
     * @return array<string, true>
     */
    private function mealsOf(array $companions): array
    {
        return Dict\from_entries(Vec\map(
            Vec\filter($this->mealAnswerRepository->findFor($companions), static fn (MealAnswer $answer): bool => MealAnswerKind::Skipped !== $answer->getKind()),
            static fn (MealAnswer $answer): array => [$answer->getPerson()->getId()->toRfc4122(), true],
        ));
    }

    /** @return array{id: string, name: string} */
    public static function group(GuestGroup $group): array
    {
        return ['id' => $group->getId()->toRfc4122(), 'name' => $group->getName()];
    }

    /**
     * @param list<Guest>                                      $companions
     * @param ?array<string, GuestNeeds>                       $needs      everybody's by id for a reader with guests.manage, null for anyone else
     * @param array<string, array{kind: string, name: string}> $seats      where each seated companion sits, by id
     * @param array<string, true>                              $meals      the companions with a meal chosen, by id
     *
     * @return array<string, mixed>
     */
    private static function guest(Guest $host, array $companions, ?array $needs, array $seats, array $meals): array
    {
        $reply = $host->getReply() ?? GuestReply::NoReply;
        $contacts = null !== $needs;
        $needsOf = static fn (Guest $person): array => null === $needs ? [] : ['needs' => self::needs($person, $needs[$person->getId()->toRfc4122()] ?? GuestNeeds::none(), note: true)];
        $zone = new DateTimeZone($host->getEvent()->getTimeZone());
        $invitedAt = $host->getInvitedAt();
        $reopenedAt = $host->getRepliesReopenedAt();
        $recordedHow = $host->getReplyRecordedHow();
        $group = $host->getGroup();

        return [
            'id' => $host->getId()->toRfc4122(),
            'fullName' => $host->getFullName(),
            'group' => null === $group ? null : self::group($group),
            'walkIn' => $host->isWalkIn(),
            'arrival' => CheckInSerialiser::arrival($host, $zone),
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
            'replyRecorded' => GuestReply::NoReply === $reply || null === $recordedHow ? null : [
                'by' => $host->getReplyRecordedBy() ?? '',
                'how' => $recordedHow->value,
            ],
            'repliesReopened' => null === $reopenedAt ? null : [
                'by' => $host->getRepliesReopenedBy() ?? '',
                'at' => $reopenedAt->setTimezone($zone)->format(\DATE_ATOM),
            ],
            'invitation' => null === $invitedAt ? null : [
                'at' => $invitedAt->setTimezone($zone)->format(\DATE_ATOM),
                'how' => $host->getInvitationMethod()?->value,
                'by' => $host->getInvitedBy()?->getName(),
            ],
            ...$needsOf($host),
            'companions' => Vec\map($companions, static fn (Guest $companion): array => [
                'seat' => $seats[$companion->getId()->toRfc4122()] ?? null,
                'meal' => $meals[$companion->getId()->toRfc4122()] ?? false,
                'id' => $companion->getId()->toRfc4122(),
                'fullName' => $companion->getFullName(),
                'state' => self::companionState(GuestStanding::of($reply, companion: true, invited: $host->isInvited(), notComingByGuest: $companion->isNotComingByGuest())),
                'coming' => !$companion->isNotComingByGuest(),
                'namedByGuest' => $companion->isNamedByGuest(),
                'arrival' => CheckInSerialiser::arrival($companion, $zone),
                ...$needsOf($companion),
            ]),
        ];
    }

    /**
     * Codes, never words: each client words them in its reader's language (sc-3777), with who changed them last and when, in the event's zone (sc-3778). The guest's own page never has the note.
     *
     * @return array<string, mixed>
     */
    public static function needs(Guest $person, GuestNeeds $needs, bool $note): array
    {
        $at = $person->getNeedsChangedAt();

        return [
            ...Dict\from_entries(Vec\map(NeedKind::cases(), static fn (NeedKind $kind): array => [$kind->field(), $needs->codesOf($kind)])),
            ...Dict\from_entries(Vec\map(NeedKind::cases(), static fn (NeedKind $kind): array => [$kind->otherField(), $needs->otherOf($kind)])),
            ...$note ? ['note' => $needs->note] : [],
            'changed' => null === $at ? null : [
                'by' => $person->isNeedsChangedByGuest() ? 'guest' : 'hosts',
                'at' => $at->setTimezone(new DateTimeZone($person->getEvent()->getTimeZone()))->format(\DATE_ATOM),
            ],
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
            ...self::guest($host, $companions, $contacts ? $this->guestNeedsRecord->of([$host, ...$companions]) : null, $this->seatsOf($companions), $this->mealsOf($companions)),
            ...$contacts ? [
                'organisationLanguage' => SupportedLocales::narrow($host->getEvent()->getOrganisation()->getLocale()),
                'optOuts' => $this->optOuts($host),
            ] : [],
            'added' => [
                'at' => $host->getCreatedAt()->format(\DATE_ATOM),
                'by' => $host->getAddedBy()?->getName(),
            ],
        ];
    }

    /** @return array<string, ?string> when the address now on each row stopped this organisation's messages on that channel (sc-3969), with guests.manage alone */
    private function optOuts(Guest $guest): array
    {
        $organisation = $guest->getEvent()->getOrganisation()->getId();

        return Dict\from_entries(Vec\map(GuestChannel::cases(), fn (GuestChannel $channel): array => [
            $channel->field(),
            $this->guestSuppressions->since($organisation, $channel, GuestChannel::Email === $channel ? $guest->getEmail() : $guest->getMobile())?->format(\DATE_ATOM),
        ]));
    }
}
