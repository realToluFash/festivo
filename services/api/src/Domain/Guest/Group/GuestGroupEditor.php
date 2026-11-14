<?php

declare(strict_types=1);

namespace App\Domain\Guest\Group;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Domain\Guest\Model\GroupChoice;
use App\Entity\Event;
use App\Entity\GuestGroup;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Symfony\Component\Uid\Uuid;

/** An event's groups (sc-3775), made, renamed and deleted under the event's lock so two hosts cannot both make the fiftieth or one name twice. */
final readonly class GuestGroupEditor
{
    public const string MADE = 'guest_group.made';

    public const string RENAMED = 'guest_group.renamed';

    public const string DELETED = 'guest_group.deleted';

    public function __construct(
        private GuestGroupRepository $guestGroupRepository,
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
    ) {
    }

    public function make(Event $event, string $typed, User $by): GuestGroup
    {
        $group = $this->entityManager->wrapInTransaction(function () use ($event, $typed, $by): GuestGroup {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $name = self::checked($typed, 'name');
            $this->refuseTaken($event, $name, 'name', null);
            $this->refuseFull($event, 'name');

            return $this->made($event, $name, $by);
        });

        $this->guestListPublisher->publish($event);

        return $group;
    }

    public function rename(GuestGroup $group, string $typed, User $by): GuestGroup
    {
        $event = $group->getEvent();
        $changed = $this->entityManager->wrapInTransaction(function () use ($group, $event, $typed, $by): bool {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $name = self::checked($typed, 'name');

            if ($name === $group->getName()) {
                return false;
            }

            $this->refuseTaken($event, $name, 'name', $group);
            $group->setName($name, self::key($name));
            $this->record(self::RENAMED, $group, $by);
            $this->entityManager->flush();

            return true;
        });

        if ($changed) {
            $this->guestListPublisher->publish($event);
        }

        return $group;
    }

    public function delete(GuestGroup $group, User $by): void
    {
        $event = $group->getEvent();
        $this->entityManager->wrapInTransaction(function () use ($group, $event, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            foreach ($this->guestRepository->findInGroup($group) as $guest) {
                $guest->setGroup(null);
            }

            $this->record(self::DELETED, $group, $by);
            $this->entityManager->remove($group);
            $this->entityManager->flush();
        });

        $this->guestListPublisher->publish($event);
    }

    /** Inside the caller's transaction, under the event's lock: a blank name is no group, and a name already used is that group. */
    public function settle(Event $event, GroupChoice $choice, User $by): ?GuestGroup
    {
        if (null !== $choice->id) {
            $group = Uuid::isValid($choice->id) ? $this->guestGroupRepository->findOneInEvent($event->getId(), Uuid::fromString($choice->id)) : null;

            return $group ?? throw ApiException::validation([self::violation('group.id', 'validation.guest_group_unknown')]);
        }

        if (null === $choice->name || '' === NameNormaliser::name($choice->name)) {
            return null;
        }

        $name = self::checked($choice->name, 'group.name');
        $found = $this->guestGroupRepository->findOneNamed($event, self::key($name));

        if (null !== $found) {
            return $found;
        }

        $this->refuseFull($event, 'group.name');

        return $this->made($event, $name, $by);
    }

    /** Case, accents and the curl of an apostrophe aside, as the web compares them before sending. */
    public static function key(string $name): string
    {
        return NameNormaliser::key(Str\replace_every($name, ['’' => "'", '‘' => "'", '`' => "'"]));
    }

    private function made(Event $event, string $name, User $by): GuestGroup
    {
        $group = new GuestGroup($event, $name, self::key($name));
        $this->entityManager->persist($group);
        $this->record(self::MADE, $group, $by);
        $this->entityManager->flush();

        return $group;
    }

    private static function checked(string $typed, string $path): string
    {
        $name = NameNormaliser::name($typed);

        if ('' === $name) {
            throw ApiException::validation([self::violation($path, 'validation.guest_group_name_required')]);
        }

        if (Str\length($name) > GuestGroup::NAME_MAXIMUM) {
            throw ApiException::validation([self::violation($path, 'validation.guest_group_name_too_long')]);
        }

        return $name;
    }

    private function refuseTaken(Event $event, string $name, string $path, ?GuestGroup $renaming): void
    {
        $found = $this->guestGroupRepository->findOneNamed($event, self::key($name));

        if (null !== $found && $found !== $renaming) {
            throw ApiException::validation([self::violation($path, 'validation.guest_group_name_taken', ['{name}' => $found->getName()])]);
        }
    }

    private function refuseFull(Event $event, string $path): void
    {
        if ($this->guestGroupRepository->countOnEvent($event) >= GuestGroup::MOST_PER_EVENT) {
            throw ApiException::validation([self::violation($path, 'validation.guest_group_limit')]);
        }
    }

    private function record(string $action, GuestGroup $group, User $by): void
    {
        $this->auditor->record($action, 'GuestGroup', $group->getId(), Actor::User, $by->getId(), $by->getName());
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string, parameters: array<string, string>}
     */
    private static function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $key,
            'code' => ErrorCode::ValidationFailed->value,
            'parameters' => ['{groupMax}' => (string) GuestGroup::NAME_MAXIMUM, '{groupsMost}' => (string) GuestGroup::MOST_PER_EVENT, ...$parameters],
        ];
    }
}
