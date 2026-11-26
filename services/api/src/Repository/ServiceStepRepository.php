<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\ServiceStep;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ParameterType;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<ServiceStep> */
final class ServiceStepRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServiceStep::class);
    }

    /** The newest step not undone that touched the subject: a plate's, a tray's or an item's id. */
    public function findLastOn(Event $event, string $subject): ?ServiceStep
    {
        $id = $this->getEntityManager()->getConnection()->fetchOne(
            <<<'SQL'
                SELECT id FROM service_steps
                WHERE event_id = :event AND NOT undone AND subjects::jsonb @> to_jsonb(CAST(:subject AS text))
                ORDER BY at DESC, id DESC
                LIMIT 1
                SQL,
            ['event' => $event->getId()->toRfc4122(), 'subject' => $subject],
            ['event' => ParameterType::STRING, 'subject' => ParameterType::STRING],
        );

        return \is_string($id) ? $this->find(Uuid::fromString($id)) : null;
    }
}
