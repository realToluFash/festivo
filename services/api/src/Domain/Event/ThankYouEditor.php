<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Enum\GuestPagePhase;
use App\Http\Exception\ApiException;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Normalizer;
use Psl\Regex;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The hosts' thank-you on a Finished event (sc-6476): one line in their own words, which every guest's page shows under its notice. */
final readonly class ThankYouEditor
{
    public const string SAVED = 'event.thank_you_saved';

    public const string REMOVED = 'event.thank_you_removed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    /** Null when nothing is left once trimmed; refused 422 over the limit, counted in code points as the clients count it. */
    public function clean(?string $typed): ?string
    {
        $spaced = Str\trim(Regex\replace($typed ?? '', '/\s+/u', ' '));
        $normalised = \normalizer_normalize($spaced, Normalizer::FORM_C);
        $line = false === $normalised ? $spaced : $normalised;

        if (Str\length($line) > Event::THANK_YOU_MAXIMUM) {
            throw ApiException::validation([[
                'propertyPath' => 'thankYou',
                'message' => $this->translator->trans('validation.event_thank_you_too_long', ['{count}' => (string) Event::THANK_YOU_MAXIMUM]),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        return '' === $line ? null : $line;
    }

    /** Saved empty, there is no line. Refused 409 `event_state_invalid` unless the event is Finished: never while Paused, called off or not yet over. */
    public function save(Event $event, ?string $typed, User $by): Event
    {
        $line = $this->clean($typed);

        return $this->entityManager->wrapInTransaction(function () use ($event, $line, $by): Event {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $this->requireFinished($event, $this->clock->now());
            $before = $event->getThankYou();

            if ($before === $line) {
                return $event;
            }

            $event->setThankYou($line);
            $this->auditor->record(null === $line ? self::REMOVED : self::SAVED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), []);
            $this->entityManager->flush();

            return $event;
        });
    }

    /** As the guest's page has it: Finished by the clock or by End now, and never called off. */
    public function requireFinished(Event $event, DateTimeImmutable $now): void
    {
        if (GuestPagePhase::Finished === GuestPagePhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $event->getEndedAt(), $now)) {
            return;
        }

        throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: [
            'phase' => EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now)->value,
        ]);
    }
}
