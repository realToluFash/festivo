<?php

declare(strict_types=1);

namespace App\Deletion;

use App\Audit\Auditor;
use App\Doctrine\Interfaces\SoftDeletableInterface;
use App\Enum\Actor;
use App\Enum\DeletedKind;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Str;
use Psr\Clock\ClockInterface;
use RuntimeException;
use Symfony\Component\Uid\Uuid;

/** Support's undo: the thing back whole, as it was at the moment of deletion, and never once the window has closed. */
final readonly class Restorer
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    public function restore(DeletedKind $kind, Uuid $id, string $agent): SoftDeletableInterface
    {
        if ('' === Str\trim($agent)) {
            throw new RuntimeException('Name the support agent restoring it.');
        }

        $deleted = $this->findDeleted($kind, $id);
        $deletedAt = $deleted->getDeletedAt();

        if (null === $deletedAt) {
            throw new RuntimeException(Str\format('That %s is not deleted.', $kind->value));
        }

        if (!RestoreWindow::isOpen($deletedAt, $this->clock->now())) {
            throw new RuntimeException(Str\format('Its restore window closed at %s UTC. It cannot be restored.', RestoreWindow::closesAt($deletedAt)->format('Y-m-d H:i:s')));
        }

        $deleted->setDeletedAt(null);
        $deleted->setDeletedBy(null);
        $this->auditor->record($kind->restored(), $kind->subjectType(), $deleted->getId(), Actor::Agent, null, Str\trim($agent), [
            'deletedAt' => [$deletedAt->format(\DATE_ATOM), null],
        ]);
        $this->entityManager->flush();

        return $deleted;
    }

    private function findDeleted(DeletedKind $kind, Uuid $id): SoftDeletableInterface
    {
        $filters = $this->entityManager->getFilters();
        $filters->disable('soft_delete');

        try {
            $found = $this->entityManager->find($kind->entity(), $id)
                ?? throw new RuntimeException(Str\format('There is no such %s, or it has been purged.', $kind->value));
        } finally {
            $filters->enable('soft_delete');
        }

        return $found instanceof SoftDeletableInterface ? $found : throw new LogicException(Str\format('%s is not soft-deletable.', $kind->entity()));
    }
}
