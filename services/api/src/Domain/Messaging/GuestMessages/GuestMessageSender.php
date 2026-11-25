<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Audit\Auditor;
use App\Domain\Messaging\Audience\GuestAudienceResolver;
use App\Domain\Messaging\EventGate;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Event;
use App\Entity\GuestMessage;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Enum\NotificationAudienceKind;
use App\Http\Exception\ApiException;
use App\Locale\VisibleText;
use App\Repository\GuestMessageRepository;
use DateInterval;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Send on a host's message to guests (sc-3942): the message, its deliveries and its audit entry commit together, and the worker sends the queued ones. */
final readonly class GuestMessageSender
{
    public const string SENT = 'guest_message.sent';

    public function __construct(
        private GuestReach $guestReach,
        private GuestMessageRepository $guestMessageRepository,
        private NotificationScheduler $notificationScheduler,
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /**
     * @param list<string>                                 $guestIds
     * @param list<array{type: string, groupId?: ?string}> $conditions
     */
    public function check(Event $event, string $choice, array $guestIds, ?string $follows = null, array $conditions = []): GuestMessagePlan
    {
        $this->assertCanSend($event);
        [$choice, $guestIds, , $violations] = $this->audience($event, $choice, $guestIds, $follows, $conditions);

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return $this->plan($event, $choice, $guestIds, $conditions);
    }

    /**
     * @param list<string>                                 $guestIds
     * @param list<array{type: string, groupId?: ?string}> $conditions its own copy, kept on the message and resolved again by nothing after it goes
     */
    public function send(Event $event, User $by, string $choice, array $guestIds, ?string $subject, string $message, ?string $follows = null, array $conditions = []): GuestMessageSent
    {
        $this->assertCanSend($event);
        [$choice, $guestIds, $conversation, $violations] = $this->audience($event, $choice, $guestIds, $follows, $conditions);
        $subject = null === $subject ? null : Str\trim($subject);
        $subject = '' === $subject ? null : $subject;
        $message = Str\trim($message);

        if (null !== $subject && VisibleText::tooLong($subject, GuestMessage::SUBJECT_MAXIMUM)) {
            $violations[] = $this->violation('subject', 'validation.guest_message_subject_too_long', GuestMessage::SUBJECT_MAXIMUM);
        }

        if ('' === $message) {
            $violations[] = $this->violation('message', 'validation.guest_message_required');
        } elseif (VisibleText::tooLong($message, GuestMessage::BODY_MAXIMUM)) {
            $violations[] = $this->violation('message', 'validation.guest_message_too_long', GuestMessage::BODY_MAXIMUM);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        $id = Uuid::v7();

        return $this->connection->transactional(function () use ($event, $by, $choice, $guestIds, $conditions, $subject, $message, $id, $conversation): GuestMessageSent {
            $plan = $this->plan($event, $choice, $guestIds, $conditions);
            $audience = GuestAudienceResolver::audience($event->getId(), $choice, $guestIds, $conditions);
            $scheduled = $this->notificationScheduler->scheduleFannedOut(GuestMessageNotice::NAME, $id->toRfc4122(), $audience, ['message' => $id->toRfc4122()], $event, $plan->deliveries);

            $this->connection->insert('guest_messages', [
                'id' => $id->toRfc4122(),
                'event_id' => $event->getId()->toRfc4122(),
                'audience' => $choice,
                'chosen_guest_ids' => Json\encode(GuestMessage::CHOSEN === $choice ? Vec\values($guestIds) : []),
                'conditions' => GuestMessage::CONDITIONS === $choice ? Json\encode($conditions) : null,
                'subject' => $subject,
                'body' => $message,
                'created_by_id' => $by->getId()->toRfc4122(),
                'created_by_name' => $by->getName(),
                'scheduled_notification_id' => $scheduled->toRfc4122(),
                'created_at' => $this->clock->now(),
                'follows_id' => $conversation?->getId()->toRfc4122(),
            ], ['created_at' => Types::DATETIME_IMMUTABLE]);

            $this->auditor->record(self::SENT, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
                'message' => [null, $id->toRfc4122()],
                'email' => [null, $plan->toldByEmail()],
                'notSent' => [null, Iter\count($plan->deliveries) - $plan->toldByEmail()],
            ]);
            $this->entityManager->flush();

            return new GuestMessageSent($id, $plan);
        });
    }

    /**
     * @param list<string>                                 $guestIds
     * @param list<array{type: string, groupId?: ?string}> $conditions
     */
    private function plan(Event $event, string $choice, array $guestIds, array $conditions): GuestMessagePlan
    {
        $deliveries = $this->guestReach->plan($event, GuestAudienceResolver::audience($event->getId(), $choice, $guestIds, $conditions));

        if ([] === $deliveries) {
            throw ApiException::validation([match ($choice) {
                GuestMessage::ALL => $this->violation('audience', 'validation.guest_message_no_guests', code: 'no_guests'),
                GuestMessage::CONDITIONS => $this->violation('conditions', 'validation.guest_message_nobody_matches', code: 'nobody_matches'),
                default => $this->violation('guestIds', 'validation.guest_message_choose_guests'),
            }]);
        }

        return new GuestMessagePlan($deliveries);
    }

    /** @return list<string> a follow-up goes to whom the conversation's first message went, not to its audience worked out again */
    private function recipientsOf(GuestMessage $first): array
    {
        return Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'SELECT DISTINCT recipient_id FROM notification_deliveries WHERE source_id = :message AND recipient_kind = :guest',
            ['message' => $first->getId()->toRfc4122(), 'guest' => NotificationAudienceKind::Guest->value],
        ));
    }

    /**
     * @param list<string>                                 $guestIds
     * @param list<array{type: string, groupId?: ?string}> $conditions
     *
     * @return array{string, list<string>, ?GuestMessage, list<array{propertyPath: string, message: string, code: string}>}
     */
    private function audience(Event $event, string $choice, array $guestIds, ?string $follows, array $conditions): array
    {
        if (null !== $follows) {
            $conversation = $this->guestMessageRepository->findOneOn($event, $follows)?->conversation();

            return null === $conversation
                ? [$choice, [], null, [$this->violation('follows', 'validation.guest_message_follows_unknown')]]
                : [GuestMessage::CHOSEN, $this->recipientsOf($conversation), $conversation, []];
        }

        if (GuestMessage::CONDITIONS === $choice) {
            return [$choice, [], null, [] === $conditions ? [$this->violation('conditions', 'validation.guest_message_conditions_required', code: 'conditions_required')] : []];
        }

        $guestIds = self::uuids($guestIds);

        return [$choice, $guestIds, null, GuestMessage::CHOSEN === $choice && [] === $guestIds ? [$this->violation('guestIds', 'validation.guest_message_choose_guests')] : []];
    }

    /**
     * @param list<string> $guestIds
     *
     * @return list<string>
     */
    private static function uuids(array $guestIds): array
    {
        return Vec\values(Vec\filter($guestIds, Uuid::isValid(...)));
    }

    /** A Draft can't send yet, and a finished event only for 30 days after it ended; a paused one can, so the host can say why. */
    private function assertCanSend(Event $event): void
    {
        $now = $this->clock->now();
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
        $key = match (true) {
            EventPhase::Draft === $phase => 'guest_message.event_draft',
            EventPhase::Finished === $phase && $now >= ($event->getEndedAt() ?? $event->getEndsAt())->add(new DateInterval(EventGate::HOST_MESSAGES_AFTER_END)) => 'guest_message.event_ended',
            default => null,
        };

        if (null !== $key) {
            throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans($key), members: ['phase' => $phase->value]);
        }
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key, ?int $count = null, string $code = 'validation_failed'): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, null === $count ? [] : ['count' => $count]),
            'code' => $code,
        ];
    }
}
