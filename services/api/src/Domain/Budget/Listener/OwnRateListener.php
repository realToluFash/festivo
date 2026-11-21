<?php

declare(strict_types=1);

namespace App\Domain\Budget\Listener;

use App\Entity\StaffMember;
use App\Repository\StaffRateRepository;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\OnFlushEventArgs;
use Doctrine\ORM\Events;

/** A person's own rate is paid instead of their job's, so it goes when their job changes or is removed, as a job's rate goes with its job (sc-101). */
#[AsDoctrineListener(event: Events::onFlush)]
final readonly class OwnRateListener
{
    public function __construct(
        private StaffRateRepository $staffRateRepository,
    ) {
    }

    public function onFlush(OnFlushEventArgs $args): void
    {
        $entityManager = $args->getObjectManager();
        $unitOfWork = $entityManager->getUnitOfWork();

        foreach ($unitOfWork->getScheduledEntityUpdates() as $entity) {
            if (!$entity instanceof StaffMember || !\array_key_exists('job', $unitOfWork->getEntityChangeSet($entity))) {
                continue;
            }

            $rate = $this->staffRateRepository->findOfPerson($entity);

            if (null !== $rate && !$unitOfWork->isScheduledForDelete($rate)) {
                $entityManager->remove($rate);
            }
        }
    }
}
