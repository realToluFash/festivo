<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Domain\Guest\Arrival\CheckInCodes;
use App\Domain\Guest\Arrival\CheckInWindow;
use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Seating\SeatPlace;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Repository\GuestRepository;
use App\Repository\SeatAssignmentRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Vec;

/** The door's list (sc-1454): names, replies, arrivals and each person's own taken seat (sc-60684), and nothing else: no contact, need, note, group or tablemate. The count is sc-99's attended of expected. Each guest's `code` is the SHA-256 of their check-in code, so a scan finds them on a device that is offline (sc-1301). */
final readonly class CheckInSerialiser
{
    public function __construct(
        private GuestRepository $guestRepository,
        private HeadcountCalculator $headcountCalculator,
        private SeatAssignmentRepository $seatAssignmentRepository,
    ) {
    }

    /** @return array<string, mixed> */
    public function read(Event $event, DateTimeImmutable $now): array
    {
        $everybody = $this->guestRepository->findOnList($event);
        $zone = new DateTimeZone($event->getTimeZone());
        $companions = Dict\group_by(
            Vec\filter($everybody, static fn (Guest $person): bool => null !== $person->getHost()),
            static fn (Guest $companion): string => $companion->getHost()?->getId()->toRfc4122() ?? '',
        );
        $counts = $this->headcountCalculator->forEvent($event)['counts'];
        $onList = Dict\from_keys(Vec\map($everybody, static fn (Guest $person): string => $person->getId()->toRfc4122()), static fn (): bool => true);
        $seats = Dict\filter_keys(Dict\from_entries(Vec\map(
            $this->seatAssignmentRepository->findOnEvent($event),
            static fn (SeatAssignment $assignment): array => [$assignment->getGuest()->getId()->toRfc4122(), SeatPlace::of($assignment)],
        )), static fn (string $id): bool => isset($onList[$id]));
        $seat = static fn (Guest $person): ?array => $seats[$person->getId()->toRfc4122()] ?? null;

        return [
            'checkIn' => [
                'state' => CheckInWindow::stateOf($event, $now)->value,
                'opensAt' => CheckInWindow::opensAt($event)->setTimezone($zone)->format(\DATE_ATOM),
                'timeZone' => $event->getTimeZone(),
            ],
            'seated' => [] !== $seats,
            'count' => ['attended' => $counts['attended'], 'expected' => $counts['expected']],
            'guests' => Vec\map(
                Vec\filter($everybody, static fn (Guest $person): bool => null === $person->getHost()),
                static fn (Guest $host): array => [
                    'id' => $host->getId()->toRfc4122(),
                    'fullName' => $host->getFullName(),
                    'reply' => ($host->getReply() ?? GuestReply::NoReply)->value,
                    'repliedAt' => $host->getRepliedAt()?->setTimezone($zone)->format(\DATE_ATOM),
                    'code' => CheckInCodes::digestOf($host->getCheckInCode()),
                    'walkIn' => $host->isWalkIn(),
                    'arrival' => self::arrival($host, $zone),
                    'seat' => $seat($host),
                    'companions' => Vec\map($companions[$host->getId()->toRfc4122()] ?? [], static fn (Guest $companion): array => [
                        'id' => $companion->getId()->toRfc4122(),
                        'fullName' => $companion->getFullName(),
                        'state' => GuestSerialiser::companionState(GuestStanding::of($host->getReply() ?? GuestReply::NoReply, companion: true, invited: $host->isInvited(), notComingByGuest: $companion->isNotComingByGuest())),
                        'arrival' => self::arrival($companion, $zone),
                        'seat' => $seat($companion),
                    ]),
                ],
            ),
        ];
    }

    /** @return ?array{at: string, by: ?string} who recorded it by their full name: every grant is an account's (sc-71) */
    public static function arrival(Guest $person, DateTimeZone $zone): ?array
    {
        $at = $person->getArrivedAt();

        return null === $at ? null : ['at' => $at->setTimezone($zone)->format(\DATE_ATOM), 'by' => $person->getArrivedBy()?->getName()];
    }
}
