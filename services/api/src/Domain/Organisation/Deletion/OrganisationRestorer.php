<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Audit\Auditor;
use App\Entity\Organisation;
use App\Enum\Actor;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;
use RuntimeException;
use Symfony\Component\Uid\Uuid;

/** Support's undo (sc-68): the organisation back whole, as it was at the moment of deletion, and never once the window has closed. */
final readonly class OrganisationRestorer
{
    public const string RESTORED = 'organisation.restored';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    public function restore(Uuid $organisationId, string $agent): Organisation
    {
        if ('' === Str\trim($agent)) {
            throw new RuntimeException('Name the support agent restoring it.');
        }

        $organisation = $this->findDeleted($organisationId);
        $deletedAt = $organisation->getDeletedAt();

        if (null === $deletedAt) {
            throw new RuntimeException('That organisation is not deleted.');
        }

        if (!RestoreWindow::isOpen($deletedAt, $this->clock->now())) {
            throw new RuntimeException(Str\format('Its restore window closed at %s UTC. It cannot be restored.', RestoreWindow::closesAt($deletedAt)->format('Y-m-d H:i:s')));
        }

        $organisation->setDeletedAt(null);
        $organisation->setDeletedBy(null);
        $this->auditor->record(self::RESTORED, 'Organisation', $organisation->getId(), Actor::Agent, null, Str\trim($agent), [
            'deletedAt' => [$deletedAt->format(\DATE_ATOM), null],
        ]);
        $this->entityManager->flush();

        return $organisation;
    }

    private function findDeleted(Uuid $organisationId): Organisation
    {
        $filters = $this->entityManager->getFilters();
        $filters->disable('soft_delete');

        try {
            return $this->entityManager->find(Organisation::class, $organisationId)
                ?? throw new RuntimeException('There is no such organisation, or it has been purged.');
        } finally {
            $filters->enable('soft_delete');
        }
    }
}
