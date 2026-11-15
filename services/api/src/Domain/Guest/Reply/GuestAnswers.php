<?php

declare(strict_types=1);

namespace App\Domain\Guest\Reply;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\GuestRules;
use App\Domain\Guest\Model\CompanionChoice;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Model\PageReply;
use App\Domain\Guest\Model\PlaceChoice;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Enum\GuestPagePhase;
use App\Enum\GuestReply;
use App\Enum\GuestReplySource;
use App\Enum\NeedKind;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A guest's answer from their own page (sc-1439): one current reply, replaced by the next, open until the event starts and while it is neither paused nor over (sc-3591). */
final readonly class GuestAnswers
{
    public const string ANSWERED = 'guest.answered';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private GuestRepository $guestRepository,
        private GuestRules $guestRules,
        private GuestNeedsRecord $guestNeedsRecord,
        private ClockInterface $clock,
    ) {
    }

    /** Until the start, in the event's own zone, and only while the event is Live; sc-3780's reply-by date will close it earlier. */
    public function open(Guest $guest): bool
    {
        return GuestPagePhase::Live === $this->phase($guest) && !$this->started($guest);
    }

    public function phase(Guest $guest): GuestPagePhase
    {
        $event = $guest->getEvent();

        return GuestPagePhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $event->getEndedAt(), $this->clock->now());
    }

    public function started(Guest $guest): bool
    {
        return $this->clock->now() >= $guest->getEvent()->getStartsAt();
    }

    /** Refused 409 `event_paused` while paused, `event_concluded` once over, `replies_closed` from the start; the same answer again keeps its date. Needs go only with Coming (sc-3778), keep the hosts' note, and may drop a host's access need but never add one (422, nothing saved). */
    public function answer(Guest $guest, GuestReply $reply, ?PageReply $page = null): void
    {
        $page ??= new PageReply([], null);
        $changed = $this->entityManager->wrapInTransaction(function () use ($guest, $reply, $page): bool {
            $this->entityManager->refresh($guest, LockMode::PESSIMISTIC_WRITE);

            $refusal = $this->phase($guest)->refusal();

            if (null !== $refusal) {
                throw new ApiException($refusal, ErrorCode::EventPaused === $refusal ? 'guest.event_paused' : 'guest.event_concluded');
            }

            if ($this->started($guest)) {
                throw new ApiException(ErrorCode::RepliesClosed, 'guest.replies_closed');
            }

            [$placed, $unnamed] = $this->chosen($this->guestRepository->findCompanionsOf($guest), $page);
            $needs = GuestReply::Coming === $reply ? $this->needs($guest, $page, $placed, $unnamed) : [];

            $replied = $guest->reply($reply, $this->clock->now(), GuestReplySource::GuestPage);
            $chose = false;

            foreach ($placed as [$place, $choice]) {
                $was = self::state($place);
                $place->nameByGuest($choice->fullName, $choice->nameKey);
                $place->markComingByGuest($choice->coming);
                $chose = $was !== self::state($place) || $chose;
            }

            foreach ($unnamed as [$place, $choice]) {
                $was = self::state($place);
                $place->markComingByGuest($choice->coming);
                $chose = $was !== self::state($place) || $chose;
            }
            $noted = false;

            foreach ($needs as [$person, $theirs]) {
                $noted = $this->guestNeedsRecord->write($person, $theirs, null) || $noted;
            }

            if ($chose || $noted) {
                $guest->raiseVersion();
            }

            if (!$replied && !$chose && !$noted) {
                return false;
            }

            $this->auditor->record(self::ANSWERED, 'Guest', $guest->getId());
            $this->entityManager->flush();

            return true;
        });

        if ($changed) {
            $event = $guest->getEvent();
            $this->guestListPublisher->publish($event);
        }
    }

    /**
     * Each choice with the place it names by id: a companion's, or one nobody named, which a name fills (sc-48740); a place left unnamed only by its own id. Refused 422 for an id that is not one of this guest's places, or not an unnamed one left unnamed, and for one sent twice.
     *
     * @param list<Guest> $places
     *
     * @return array{list<array{Guest, CompanionChoice}>, list<array{Guest, PlaceChoice}>}
     */
    private function chosen(array $places, PageReply $page): array
    {
        $byId = Dict\from_entries(Vec\map($places, static fn (Guest $place): array => [$place->getId()->toRfc4122(), $place]));
        $violations = [];
        $seen = [];

        foreach ($page->companions as $index => $choice) {
            if (!Iter\contains_key($byId, $choice->id) || Iter\contains_key($seen, $choice->id)) {
                $violations[] = $this->guestRules->violation("companions[{$index}].id", 'validation.guest_companion_unknown');
            }

            $seen[$choice->id] = true;
        }

        foreach ($page->unnamed as $index => $one) {
            $place = $byId[$one->id] ?? null;

            if (null === $place || null !== $place->getFullName() || Iter\contains_key($seen, $one->id)) {
                $violations[] = $this->guestRules->violation("unnamed[{$index}].id", 'validation.guest_companion_unknown');
            }

            $seen[$one->id] = true;
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return [
            Vec\map($page->companions, static fn (CompanionChoice $choice): array => [$byId[$choice->id], $choice]),
            Vec\map($page->unnamed, static fn (PlaceChoice $one): array => [$byId[$one->id], $one]),
        ];
    }

    /**
     * @param list<array{Guest, CompanionChoice}> $placed
     * @param list<array{Guest, PlaceChoice}>     $unnamed
     *
     * @return list<array{Guest, GuestNeeds}>
     */
    private function needs(Guest $guest, PageReply $page, array $placed, array $unnamed): array
    {
        $sent = null === $page->needs ? [] : [['needs', $guest, $page->needs]];
        $violations = [];

        foreach ($placed as $index => [$place, $choice]) {
            if (null !== $choice->needs) {
                $sent[] = ["companions[{$index}].needs", $place, $choice->needs];
            }
        }

        foreach ($unnamed as $index => [$place, $choice]) {
            if (null !== $choice->needs) {
                $sent[] = ["unnamed[{$index}].needs", $place, $choice->needs];
            }
        }

        $records = $this->guestNeedsRecord->of(Vec\map($sent, static fn (array $one): Guest => $one[1]));
        $needs = [];

        foreach ($sent as [$path, $person, $typed]) {
            $was = $records[$person->getId()->toRfc4122()] ?? GuestNeeds::none();
            $added = Vec\filter(
                $typed->codesOf(NeedKind::Access),
                static fn (string $code): bool => NeedKind::OTHER !== $code && !Iter\contains($was->codesOf(NeedKind::Access), $code),
            );

            if ([] !== $added) {
                $violations[] = $this->guestRules->violation("{$path}.access", 'validation.guest_need_unknown');
            }

            $needs[] = [$person, new GuestNeeds($typed->codes, $typed->others, $was->note)];
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return $needs;
    }

    /** @return array{?string, bool} */
    private static function state(Guest $place): array
    {
        return [$place->getFullName(), $place->isNotComingByGuest()];
    }
}
