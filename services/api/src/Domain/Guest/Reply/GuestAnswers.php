<?php

declare(strict_types=1);

namespace App\Domain\Guest\Reply;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Domain\Guest\Model\CompanionChoice;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Enum\GuestPagePhase;
use App\Enum\GuestReply;
use App\Enum\GuestReplySource;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A guest's answer from their own page (sc-1439): one current reply, replaced by the next, open until the event starts and while it is neither paused nor over (sc-3591). */
final readonly class GuestAnswers
{
    public const string ANSWERED = 'guest.answered';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
        private GuestRepository $guestRepository,
        private TranslatorInterface $translator,
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

    /**
     * Refused 409 `event_paused` while paused, `event_concluded` once called off or over, and `replies_closed` from the start. The same answer again changes nothing and keeps its date.
     *
     * @param list<CompanionChoice> $companions who fills the places (sc-3779); a named companion left out keeps their name and choice
     */
    public function answer(Guest $guest, GuestReply $reply, array $companions = []): void
    {
        $changed = $this->entityManager->wrapInTransaction(function () use ($guest, $reply, $companions): bool {
            $this->entityManager->refresh($guest, LockMode::PESSIMISTIC_WRITE);

            $refusal = $this->phase($guest)->refusal();

            if (null !== $refusal) {
                throw new ApiException($refusal, ErrorCode::EventPaused === $refusal ? 'guest.event_paused' : 'guest.event_concluded');
            }

            if ($this->started($guest)) {
                throw new ApiException(ErrorCode::RepliesClosed, 'guest.replies_closed');
            }

            $replied = $guest->reply($reply, $this->clock->now(), GuestReplySource::GuestPage);
            $chose = $this->choose($guest, $companions);

            if (!$replied && !$chose) {
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
     * Places are the cap: a new name takes the first unnamed place, and one beyond them is refused 422 with nothing saved. False when nothing changed.
     *
     * @param list<CompanionChoice> $choices
     */
    private function choose(Guest $guest, array $choices): bool
    {
        if ([] === $choices) {
            return false;
        }

        $places = $this->guestRepository->findCompanionsOf($guest);
        $named = Dict\from_entries(Vec\map(
            Vec\filter($places, static fn (Guest $place): bool => null !== $place->getFullName()),
            static fn (Guest $place): array => [$place->getId()->toRfc4122(), $place],
        ));
        $unnamed = Vec\values(Vec\filter($places, static fn (Guest $place): bool => null === $place->getFullName()));
        $violations = [];
        $seen = [];
        $fills = 0;

        foreach ($choices as $index => $choice) {
            if (null === $choice->id) {
                ++$fills;
                continue;
            }

            if (!Iter\contains_key($named, $choice->id) || Iter\contains_key($seen, $choice->id)) {
                $violations[] = $this->violation("companions[{$index}].id", 'validation.guest_companion_unknown');
            }

            $seen[$choice->id] = true;
        }

        if ($fills > Iter\count($unnamed)) {
            $violations[] = $this->violation('companions', 'validation.guest_places_full');
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        $before = Vec\map($places, self::state(...));
        $fill = 0;

        foreach ($choices as $choice) {
            $place = null === $choice->id ? $unnamed[$fill++] : $named[$choice->id];
            $place->nameByGuest($choice->fullName, $choice->nameKey);
            $place->markComingByGuest($choice->coming);
        }

        return $before !== Vec\map($places, self::state(...));
    }

    /** @return array{?string, bool} */
    private static function state(Guest $place): array
    {
        return [$place->getFullName(), $place->isNotComingByGuest()];
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
