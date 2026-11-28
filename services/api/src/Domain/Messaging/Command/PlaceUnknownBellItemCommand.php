<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Command;

use App\Domain\Messaging\Http\NotificationItemSerialiser;
use App\Domain\Messaging\NotificationItemPruner;
use App\Entity\NotificationItem;
use App\Entity\User;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use App\Repository\NotificationItemRepository;
use App\Repository\UserRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\When;
use Symfony\Component\Uid\Uuid;

/** QA's way to an item from a server newer than the client (sc-84143): the six categories are all this server sends, so the item is written here. Registered on the local and QA stacks only. */
#[When(env: 'dev')]
#[When(env: 'test')]
#[AsCommand(name: 'app:dev:unknown-bell-item', description: 'Put an unread bell item of a category no client knows in a member\'s feed, and publish it live')]
final readonly class PlaceUnknownBellItemCommand
{
    public const string CATEGORY = 'venue_news';

    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private UserRepository $userRepository,
        private NotificationItemRepository $notificationItemRepository,
        private NotificationItemPruner $notificationItemPruner,
        private RealtimePublisher $realtimePublisher,
        private ClockInterface $clock,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument(description: 'The member\'s email address')]
        string $email,
        #[Option(description: 'The id of an event the item names')]
        ?string $event = null,
        #[Option(description: 'The item\'s title')]
        string $title = 'Ana Souza added a note to the event',
    ): int {
        $user = $this->userRepository->findOneByPrimaryEmailAddress($email);

        if (!$user instanceof User) {
            $io->error(Str\format('No member has the address %s.', $email));

            return Command::FAILURE;
        }

        $named = null === $event ? null : $this->event($event, $user);

        if (null !== $event && null === $named) {
            $io->error(Str\format('No event has the id %s.', $event));

            return Command::FAILURE;
        }

        $id = Uuid::v7()->toRfc4122();
        $this->connection->insert('notification_items', [
            'id' => $id,
            'user_id' => $user->getId()->toRfc4122(),
            'category' => self::CATEGORY,
            'title' => $title,
            'lines' => Json\encode([]),
            'event_id' => $event,
            'event_name' => $named['name'] ?? null,
            'place' => null === $event ? null : '/app/events/' . $event,
            'muted' => $named['muted'] ?? false,
            'read_at' => null,
            'created_at' => $this->clock->now(),
        ], ['muted' => Types::BOOLEAN, 'created_at' => Types::DATETIME_IMMUTABLE]);

        $item = Type\instance_of(NotificationItem::class)->coerce($this->notificationItemRepository->find($id));
        $published = NotificationItemSerialiser::item($item, null !== $named);
        $published['unreadCount'] = $this->notificationItemRepository->countUnreadFor($user, $this->notificationItemPruner->keptSince());
        $this->realtimePublisher->publishOrFail(RealtimeTopic::UserNotifications, $user->getId()->toRfc4122(), $published);
        $this->entityManager->clear();

        $io->writeln(Str\format('Placed %s in %s\'s bell, category %s.', $id, $email, self::CATEGORY));

        return Command::SUCCESS;
    }

    /** @return array{name: string, muted: bool}|null */
    private function event(string $id, User $user): ?array
    {
        if (!Uuid::isValid($id)) {
            return null;
        }

        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT e.name, EXISTS (SELECT 1 FROM event_mutes m WHERE m.event_id = e.id AND m.user_id = :user) AS muted
                FROM events e
                JOIN organisations o ON o.id = e.organisation_id
                WHERE e.id = :id AND e.deleted_at IS NULL AND o.deleted_at IS NULL
                SQL,
            ['id' => $id, 'user' => $user->getId()->toRfc4122()],
        );

        return false === $row ? null : Type\shape(['name' => Type\string(), 'muted' => Type\bool()])->coerce($row);
    }
}
