<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Domain\Organisation\Handover\Model\Responsibility;
use App\Domain\Organisation\Handover\Model\ResponsibleField;
use App\Domain\Organisation\Interfaces\ResponsibilityLedgerInterface;
use App\Entity\Organisation;
use App\Entity\User;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Reads and moves the fields ResponsibleFields lists, whichever entity holds them. */
final readonly class DoctrineResponsibilityLedger implements ResponsibilityLedgerInterface
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function heldBy(Organisation $organisation, User $user): array
    {
        return Vec\flat_map(ResponsibleFields::all(), fn (ResponsibleField $field): array => Vec\map(
            Type\vec(Type\object())->coerce($this->entityManager->createQueryBuilder()
                ->select('e')
                ->from($field->entity, 'e')
                ->where('e.organisation = :organisation')
                ->andWhere('e.' . $field->property . ' = :user')
                ->setParameter('organisation', $organisation)
                ->setParameter('user', $user)
                ->orderBy('e.id', 'ASC')
                ->getQuery()
                ->getResult()),
            fn (object $held): Responsibility => $this->responsibility($field, $held),
        ));
    }

    public function move(Responsibility $responsibility, User $to): void
    {
        $field = $responsibility->field;
        $held = $this->entityManager->find($field->entity, $responsibility->id)
            ?? throw ApiException::notFound('Not found.');
        $this->entityManager->getClassMetadata($field->entity)->setFieldValue($held, $field->property, $to);
    }

    private function responsibility(ResponsibleField $field, object $held): Responsibility
    {
        $metadata = $this->entityManager->getClassMetadata($field->entity);

        return new Responsibility(
            $field,
            Type\instance_of(Uuid::class)->coerce($metadata->getFieldValue($held, 'id')),
            Type\string()->coerce($metadata->getFieldValue($held, $field->titleProperty)),
        );
    }
}
