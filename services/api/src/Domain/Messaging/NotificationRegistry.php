<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Exception\UnregisteredNotificationType;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use LogicException;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/** Epic 36's one list: every type the product sends, and the senders that can carry them. */
final readonly class NotificationRegistry
{
    /** @var array<string, NotificationTypeInterface> */
    private array $types;

    /** @var array<string, ChannelSenderInterface> */
    private array $senders;

    /**
     * @param iterable<NotificationTypeInterface> $types
     * @param iterable<ChannelSenderInterface>    $senders
     */
    public function __construct(
        #[AutowireIterator(NotificationTypeInterface::TAG)]
        iterable $types,
        #[AutowireIterator(ChannelSenderInterface::TAG)]
        iterable $senders,
    ) {
        $byName = [];

        foreach ($types as $type) {
            if (isset($byName[$type->name()])) {
                throw new LogicException(Str\format('Two notification types are named "%s".', $type->name()));
            }

            $byName[$type->name()] = $type;
        }

        $byChannel = [];

        foreach ($senders as $sender) {
            $byChannel[$sender->channel()->value] = $sender;
        }

        $this->types = $byName;
        $this->senders = $byChannel;
    }

    /** @throws UnregisteredNotificationType */
    public function type(string $name): NotificationTypeInterface
    {
        return $this->types[$name] ?? throw new UnregisteredNotificationType($name);
    }

    public function has(string $name): bool
    {
        return isset($this->types[$name]);
    }

    /** @return list<NotificationTypeInterface> */
    public function types(): array
    {
        return Vec\values($this->types);
    }

    public function sender(\App\Enum\NotificationChannel $channel): ?ChannelSenderInterface
    {
        return $this->senders[$channel->value] ?? null;
    }
}
