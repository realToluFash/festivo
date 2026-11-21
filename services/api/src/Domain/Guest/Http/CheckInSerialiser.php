<?php

declare(strict_types=1);

namespace App\Domain\Guest\Http;

use App\Domain\Guest\Arrival\CheckInWindow;
use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Repository\GuestRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Dict;
use Psl\Vec;

/** The door's list (sc-1454): names, replies and arrivals, and nothing else: no contact, need, note or group. The count is sc-99's attended of expected. */
final readonly class CheckInSerialiser
{
    public function __construct(
        private GuestRepository $guestRepository,
        private HeadcountCalculator $headcountCalculator,
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

        return [
            'checkIn' => [
                'state' => CheckInWindow::stateOf($event, $now)->value,
                'opensAt' => CheckInWindow::opensAt($event)->setTimezone($zone)->format(\DATE_ATOM),
                'timeZone' => $event->getTimeZone(),
            ],
            'count' => ['attended' => $counts['attended'], 'expected' => $counts['expected']],
            'guests' => Vec\map(
                Vec\filter($everybody, static fn (Guest $person): bool => null === $person->getHost()),
                static fn (Guest $host): array => [
                    'id' => $host->getId()->toRfc4122(),
                    'fullName' => $host->getFullName(),
                    'reply' => ($host->getReply() ?? GuestReply::NoReply)->value,
                    'walkIn' => $host->isWalkIn(),
                    'arrival' => self::arrival($host, $zone),
                    'companions' => Vec\map($companions[$host->getId()->toRfc4122()] ?? [], static fn (Guest $companion): array => [
                        'id' => $companion->getId()->toRfc4122(),
                        'fullName' => $companion->getFullName(),
                        'state' => GuestSerialiser::companionState(GuestStanding::of($host->getReply() ?? GuestReply::NoReply, companion: true, invited: $host->isInvited(), notComingByGuest: $companion->isNotComingByGuest())),
                        'arrival' => self::arrival($companion, $zone),
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
