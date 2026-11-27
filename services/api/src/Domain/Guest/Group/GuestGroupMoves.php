<?php

declare(strict_types=1);

namespace App\Domain\Guest\Group;

use App\Audit\Auditor;
use App\Domain\Guest\GuestListPublisher;
use App\Domain\Guest\Model\GroupChoice;
use App\Domain\Guest\Model\MovedTogether;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\GuestRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;

/** Add to group for many guests at once (sc-3776): one group, chosen or made by sc-3775's rules, every guest moved or none, and one audit entry with the count. */
final readonly class GuestGroupMoves
{
    public const string MOVED = 'guests.moved_to_group';

    public function __construct(
        private GuestGroupEditor $guestGroupEditor,
        private GuestRepository $guestRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private GuestListPublisher $guestListPublisher,
    ) {
    }

    /** @param list<string> $guestIds */
    public function move(Event $event, array $guestIds, GroupChoice $choice, User $by): MovedTogether
    {
        $moved = $this->entityManager->wrapInTransaction(function () use ($event, $guestIds, $choice, $by): MovedTogether {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $group = $this->guestGroupEditor->settle($event, $choice, $by) ?? throw ApiException::validation([self::required()]);
            $hosts = $this->guestRepository->lockHostsOn($event, $guestIds);
            $moving = Vec\filter($hosts, static fn (Guest $host): bool => $host->getGroup() !== $group);

            foreach ($moving as $host) {
                $host->setGroup($group);
                $host->raiseVersion();
            }

            if ([] !== $moving) {
                $this->auditor->record(self::MOVED, 'GuestGroup', $group->getId(), Actor::User, $by->getId(), $by->getName(), changes: [
                    'guests' => [null, Iter\count($moving)],
                ]);
            }

            $this->entityManager->flush();

            return new MovedTogether($group, Iter\count($moving), Iter\count($hosts) - Iter\count($moving), Iter\count(Vec\unique($guestIds)) - Iter\count($hosts));
        });

        $this->guestListPublisher->publish($event);

        return $moved;
    }

    /** @return array{propertyPath: string, message: string, code: string, parameters: array<string, string>} */
    private static function required(): array
    {
        return [
            'propertyPath' => 'group.name',
            'message' => 'validation.guest_group_name_required',
            'code' => ErrorCode::ValidationFailed->value,
            'parameters' => [],
        ];
    }
}
