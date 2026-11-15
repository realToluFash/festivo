<?php

declare(strict_types=1);

namespace App\Domain\Event\Search;

use App\Domain\Event\Http\EventSerialiser;
use App\Domain\Organisation\Http\MemberSerialiser;
use App\Entity\Guest;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\InvitationStatus;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Http\Access\EventScope;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Locale\NameNormaliser;
use App\Repository\EventRepository;
use App\Repository\GuestRepository;
use App\Repository\InvitationRepository;
use App\Repository\MembershipRepository;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Search (sc-39534): a kind the person may not find is null, not empty, so a client words its field without it. */
final readonly class OrganisationSearch
{
    public const int SHOWN = 5;

    public function __construct(
        private MembershipDirectoryInterface $membershipDirectory,
        private EventRepository $eventRepository,
        private GuestRepository $guestRepository,
        private MembershipRepository $membershipRepository,
        private InvitationRepository $invitationRepository,
        private EventSerialiser $eventSerialiser,
        private ClockInterface $clock,
    ) {
    }

    /** @return array{events: bool, guests: bool, members: bool} */
    public function reach(User $user, Organisation $organisation, EventScope $scope): array
    {
        return [
            'events' => [] !== $scope->eventsHolding(Permission::EventsRead),
            'guests' => [] !== $scope->eventsHolding(Permission::GuestsRead),
            'members' => $this->holds($user, $organisation, Permission::MembersRead),
        ];
    }

    /** @return array{events: ?array{total: int, matches: list<array<string, mixed>>}, guests: ?array{total: int, matches: list<array<string, mixed>>}, members: ?array{total: int, matches: list<array<string, mixed>>}} */
    public function find(User $user, Organisation $organisation, EventScope $scope, ?string $term, bool $invitations): array
    {
        $reach = $this->reach($user, $organisation, $scope);

        if (null === $term) {
            $none = ['total' => 0, 'matches' => []];

            return ['events' => $reach['events'] ? $none : null, 'guests' => $reach['guests'] ? $none : null, 'members' => $reach['members'] ? $none : null];
        }

        $events = $scope->eventsHolding(Permission::EventsRead);
        $guests = $scope->eventsHolding(Permission::GuestsRead);

        return [
            'events' => $reach['events'] ? [
                'total' => $this->eventRepository->countNamedLike($organisation, $term, $events),
                'matches' => $this->eventSerialiser->events($this->eventRepository->findNamedLike($organisation, $term, $events, self::SHOWN), $scope),
            ] : null,
            'guests' => $reach['guests'] ? [
                'total' => $this->guestRepository->countNamedLike($organisation, $term, $guests),
                'matches' => Vec\map($this->guestRepository->findNamedLike($organisation, $term, $guests, self::SHOWN), self::guest(...)),
            ] : null,
            'members' => $reach['members'] ? $this->members($user, $organisation, $term, $invitations) : null,
        ];
    }

    /** @return array{total: int, matches: list<array<string, mixed>>} */
    private function members(User $user, Organisation $organisation, string $term, bool $invitations): array
    {
        $decides = $this->holds($user, $organisation, Permission::MembersManage);
        $now = $this->clock->now();
        $wanted = NameNormaliser::key($term);
        $found = [];

        foreach ($this->membershipRepository->findInOrganisation($organisation) as $membership) {
            if (MembershipStatus::LeftOrRemoved !== $membership->getStatus() && $membership->isListedTo($decides)) {
                $found[] = self::match($membership->getUser()->getName(), $membership->getUser()->getPrimaryEmailAddress()?->getAddress(), $wanted, self::member($membership));
            }
        }

        foreach ($invitations ? $this->invitationRepository->findForOrganisation($organisation) : [] as $invitation) {
            if (InvitationStatus::Pending === $invitation->getStatusAt($now)) {
                $found[] = self::match(null, $invitation->getEmail(), $wanted, self::invited($invitation));
            }
        }

        $matched = Vec\sort(Vec\filter_nulls($found), static fn (array $a, array $b): int => [$a['later'], $a['key'], $a['row']['id']] <=> [$b['later'], $b['key'], $b['row']['id']]);

        return [
            'total' => Iter\count($matched),
            'matches' => Vec\map(Vec\slice($matched, 0, self::SHOWN), static fn (array $one): array => $one['row']),
        ];
    }

    /**
     * Ranked by the name the row shows, which is the email for somebody with none yet.
     *
     * @param array{id: string, kind: string, name: ?string, email: ?string, role: ?array{id: string, seededAs: string}, status: string} $row
     *
     * @return array{later: int, key: string, row: array{id: string, kind: string, name: ?string, email: ?string, role: ?array{id: string, seededAs: string}, status: string}}|null
     */
    private static function match(?string $name, ?string $email, string $wanted, array $row): ?array
    {
        $named = NameNormaliser::key($name ?? $email ?? '');
        $addressed = NameNormaliser::key($email ?? '');

        if (!Str\contains($named, $wanted) && !Str\contains($addressed, $wanted)) {
            return null;
        }

        return ['later' => Str\starts_with($named, $wanted) ? 0 : 1, 'key' => $named, 'row' => $row];
    }

    /** @return array{id: string, kind: string, name: ?string, email: ?string, role: ?array{id: string, seededAs: string}, status: string} */
    private static function member(Membership $membership): array
    {
        return [
            'id' => $membership->getId()->toRfc4122(),
            'kind' => 'member',
            'name' => $membership->getUser()->getName(),
            'email' => $membership->getUser()->getPrimaryEmailAddress()?->getAddress(),
            'role' => MemberSerialiser::role($membership->getRole()),
            'status' => $membership->getStatus()->value,
        ];
    }

    /** @return array{id: string, kind: string, name: ?string, email: ?string, role: ?array{id: string, seededAs: string}, status: string} */
    private static function invited(Invitation $invitation): array
    {
        $role = $invitation->getRole();

        return [
            'id' => $invitation->getId()->toRfc4122(),
            'kind' => 'invitation',
            'name' => null,
            'email' => $invitation->getEmail(),
            'role' => null === $role ? null : MemberSerialiser::role($role),
            'status' => 'invited',
        ];
    }

    /** @return array<string, mixed> no contact details: Search shows a guest by name and event alone */
    private static function guest(Guest $guest): array
    {
        $event = $guest->getEvent();

        return [
            'id' => $guest->getId()->toRfc4122(),
            'name' => $guest->getFullName(),
            'event' => [
                'id' => $event->getId()->toRfc4122(),
                'name' => $event->getName(),
                'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
                'timeZone' => $event->getTimeZone(),
            ],
        ];
    }

    private function holds(User $user, Organisation $organisation, Permission $permission): bool
    {
        return true === $this->membershipDirectory->grantsIn($user, $organisation->getId())?->holds($permission);
    }
}
