<?php

declare(strict_types=1);

namespace App\Realtime;

use App\Entity\User;
use App\Enum\RealtimeTopic;
use DateTimeImmutable;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** A hub subscriber token naming only topics the caller may read, signed with the key the hub accepts for subscribing and never for publishing. */
final readonly class SubscriberTokenIssuer
{
    public const int LIFETIME_SECONDS = 900;

    /** Someone who loses seating.read stops receiving the plan and its presence within this (sc-4719). */
    public const int SEATING_LIFETIME_SECONDS = 600;

    public function __construct(
        #[SensitiveParameter]
        private string $mercureSubscriberKey,
        private ClockInterface $clock,
    ) {
    }

    public function issueFor(User $user): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::UserNotifications->for($user->getId()->toRfc4122())]);
    }

    /** The hub shows the payload to the event's other subscribers: a name, never an email address (sc-4719). */
    public function issueForEventSeating(Uuid $eventId, User $user, bool $editor): IssuedSubscriberToken
    {
        $seating = RealtimeTopic::EventSeating->for($eventId->toRfc4122());

        return $this->issue(
            [$seating, RealtimeTopic::EventSeatingChoices->for($eventId->toRfc4122()), self::subscribersOf($seating)],
            ['userId' => $user->getId()->toRfc4122(), 'name' => $user->getName(), 'editor' => $editor],
            self::SEATING_LIFETIME_SECONDS,
        );
    }

    /** The hub's active-subscriptions topic for one topic, matching its list and each subscriber arriving and leaving. */
    public static function subscribersOf(string $topic): string
    {
        return '/.well-known/mercure/subscriptions/' . \urlencode($topic) . '{/subscriber}';
    }

    /** One event's roster, for someone the route has already found holds staff.read on it (sc-3906). */
    public function issueForEventStaff(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventStaff->for($eventId->toRfc4122())]);
    }

    /** One event's running order, for someone the route has already found holds run_of_show.read on it (sc-3893). */
    public function issueForEventSchedule(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventSchedule->for($eventId->toRfc4122())]);
    }

    /** One event's room screens' signal to ask again, for a screen link the route has already found current (sc-3897); its messages carry nothing else. */
    public function issueForEventScreens(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventScreens->for($eventId->toRfc4122())]);
    }

    /** One event's guest pages' signal to ask again, for a guest link the route has already found (sc-4022); its messages carry nothing else. */
    public function issueForGuestPages(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventGuestPages->for($eventId->toRfc4122())]);
    }

    /** One event's messages to its guests' signal to ask again, for someone the route has already found holds messages.read on it (sc-3942); its messages carry nothing else. */
    public function issueForEventMessages(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventMessages->for($eventId->toRfc4122())]);
    }

    /** One event's menu, for someone the route has already found holds menu.read on it (sc-3902). */
    public function issueForEventMenu(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventMenu->for($eventId->toRfc4122())]);
    }

    /** One event's budget lines and its headcount, which moves the range, for someone the route has already found holds budget.read on it (sc-83, sc-85). */
    public function issueForEventBudget(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventBudget->for($eventId->toRfc4122()), RealtimeTopic::EventQuotes->for($eventId->toRfc4122()), RealtimeTopic::EventHeadcount->for($eventId->toRfc4122()), RealtimeTopic::EventCheckIn->for($eventId->toRfc4122())]);
    }

    /** One event's markups, client prices and margin, for someone the route has already found holds budget.margin on it with a plan that unlocks margin (sc-92). */
    public function issueForEventBudgetMargin(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventBudgetMargin->for($eventId->toRfc4122()), RealtimeTopic::EventHeadcount->for($eventId->toRfc4122()), RealtimeTopic::EventCheckIn->for($eventId->toRfc4122())]);
    }

    /** One event's guest list and its headcount, for someone the route has already found holds guests.read on it (sc-1468, sc-99). */
    public function issueForEventGuests(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventGuests->for($eventId->toRfc4122()), RealtimeTopic::EventHeadcount->for($eventId->toRfc4122()), RealtimeTopic::EventCheckIn->for($eventId->toRfc4122())]);
    }

    /** One event's check-in signal, for someone the route has already found holds guests.check_in on it (sc-1454); its messages carry nothing else. */
    public function issueForCheckIn(Uuid $eventId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::EventCheckIn->for($eventId->toRfc4122())]);
    }

    /** One organisation's usage, for someone the route has already found holds billing.read on it (sc-3929). */
    public function issueForOrganisationUsage(Uuid $organisationId): IssuedSubscriberToken
    {
        return $this->issue([RealtimeTopic::OrganisationUsage->for($organisationId->toRfc4122())]);
    }

    /**
     * Several events' headcounts, for someone the route has already found holds guests.read on each (sc-3786).
     *
     * @param list<Uuid> $eventIds
     */
    public function issueForHeadcounts(array $eventIds): IssuedSubscriberToken
    {
        return $this->issue(Vec\flat_map($eventIds, static fn (Uuid $eventId): array => [RealtimeTopic::EventHeadcount->for($eventId->toRfc4122()), RealtimeTopic::EventCheckIn->for($eventId->toRfc4122())]));
    }

    /**
     * @param list<string>              $topics
     * @param array<string, mixed>|null $payload
     */
    private function issue(array $topics, ?array $payload = null, int $lifetimeSeconds = self::LIFETIME_SECONDS): IssuedSubscriberToken
    {
        $configuration = Configuration::forSymmetricSigner(new Sha256(), InMemory::plainText(Type\non_empty_string()->coerce($this->mercureSubscriberKey)));
        $now = DateTimeImmutable::createFromInterface($this->clock->now());
        $expiresAt = $now->modify('+' . $lifetimeSeconds . ' seconds');

        $token = $configuration->builder()
            ->issuedAt($now)
            ->expiresAt($expiresAt)
            ->withClaim('mercure', null === $payload ? ['subscribe' => $topics] : ['subscribe' => $topics, 'payload' => $payload])
            ->getToken($configuration->signer(), $configuration->signingKey());

        return new IssuedSubscriberToken($token->toString(), $expiresAt);
    }
}
