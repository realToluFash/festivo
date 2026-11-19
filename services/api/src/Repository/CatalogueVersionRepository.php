<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CatalogueVersion;
use App\Enum\CataloguePart;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<CatalogueVersion> */
final class CatalogueVersionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CatalogueVersion::class);
    }

    /** @return list<CatalogueVersion> every version of both parts, oldest first */
    public function findAllInOrder(): array
    {
        return $this->findBy([], ['effectiveFrom' => 'ASC', 'publishedAt' => 'ASC', 'id' => 'ASC']);
    }

    public function findOneByName(CataloguePart $part, string $name): ?CatalogueVersion
    {
        return $this->findOneBy(['part' => $part, 'name' => $name]);
    }

    public function countOf(CataloguePart $part): int
    {
        return $this->count(['part' => $part]);
    }
}
