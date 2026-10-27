<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Entity\Event;
use App\Entity\EventMute;
use App\Entity\User;
use App\Repository\EventMuteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;

/** Mute this event, on or off. It applies to what is fanned out from now; deliveries already written go as they were. */
final readonly class EventMuter
{
    public function __construct(
        private EventMuteRepository $eventMuteRepository,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function set(User $user, Event $event, bool $muted): void
    {
        $mute = $this->eventMuteRepository->findOneFor($user, $event);

        if ($muted && null === $mute) {
            $this->entityManager->persist(new EventMute($user, $event, $this->clock->now()));
        } elseif (!$muted && null !== $mute) {
            $this->entityManager->remove($mute);
        }

        $this->entityManager->flush();
    }
}
