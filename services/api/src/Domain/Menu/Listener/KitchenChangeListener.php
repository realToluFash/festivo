<?php

declare(strict_types=1);

namespace App\Domain\Menu\Listener;

use App\Domain\Menu\Kitchen\KitchenUnsent;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestNeed;
use App\Entity\KitchenCopy;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Repository\EventRepository;
use App\Repository\KitchenCopyRepository;
use Closure;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\OnFlushEventArgs;
use Doctrine\ORM\Events;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\ConsoleEvents;
use Symfony\Component\DependencyInjection\Attribute\AutowireServiceClosure;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** Anything that can move a figure on the kitchen sheet marks its event; once the response has gone, an event with a copy is compared with it, so its milestone comes back at that moment (sc-30692). */
#[AsDoctrineListener(event: Events::onFlush)]
#[AsEventListener(event: KernelEvents::TERMINATE, method: 'check')]
#[AsEventListener(event: ConsoleEvents::TERMINATE, method: 'check')]
final class KitchenChangeListener
{
    /** @var array<string, Uuid> by event id */
    private array $marked = [];

    /**
     * Closures: a Doctrine listener that built these would build the entity manager it listens on.
     *
     * @param Closure(): KitchenUnsent         $kitchenUnsent
     * @param Closure(): EventRepository       $eventRepository
     * @param Closure(): KitchenCopyRepository $kitchenCopyRepository
     */
    public function __construct(
        #[AutowireServiceClosure(KitchenUnsent::class)]
        private readonly Closure $kitchenUnsent,
        #[AutowireServiceClosure(EventRepository::class)]
        private readonly Closure $eventRepository,
        #[AutowireServiceClosure(KitchenCopyRepository::class)]
        private readonly Closure $kitchenCopyRepository,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function onFlush(OnFlushEventArgs $args): void
    {
        $unitOfWork = $args->getObjectManager()->getUnitOfWork();

        foreach ([...$unitOfWork->getScheduledEntityInsertions(), ...$unitOfWork->getScheduledEntityUpdates(), ...$unitOfWork->getScheduledEntityDeletions()] as $entity) {
            $event = self::eventOf($entity);

            if (null !== $event) {
                $this->mark($event);
            }
        }
    }

    public function mark(Event $event): void
    {
        $this->marked[$event->getId()->toRfc4122()] = $event->getId();
    }

    public function check(): void
    {
        $marked = $this->marked;
        $this->marked = [];

        foreach ($marked as $id) {
            try {
                $event = ($this->eventRepository)()->find($id);

                if (null !== $event && ($this->kitchenCopyRepository)()->anyForEvent($event)) {
                    ($this->kitchenUnsent)()->check($event, false);
                }
            } catch (Throwable $e) {
                // The next read of the timeline checks again.
                $this->logger->error('The kitchen sheet could not be compared with its latest copy.', ['eventId' => $id->toRfc4122(), 'exception' => $e::class]);
            }
        }
    }

    private static function eventOf(object $entity): ?Event
    {
        return match (true) {
            $entity instanceof Event => $entity,
            $entity instanceof Guest, $entity instanceof MenuCourse, $entity instanceof KitchenCopy => $entity->getEvent(),
            $entity instanceof GuestNeed => $entity->getGuest()->getEvent(),
            $entity instanceof MealAnswer => $entity->getPerson()->getEvent(),
            $entity instanceof MenuDish => $entity->getCourse()->getEvent(),
            $entity instanceof MenuDishVariant, $entity instanceof MenuDishChoice => $entity->getDish()->getCourse()->getEvent(),
            $entity instanceof MenuChoiceOption => $entity->getChoice()->getDish()->getCourse()->getEvent(),
            default => null,
        };
    }
}
