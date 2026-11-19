<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organisation;
use App\Entity\Vendor;
use App\Enum\VendorCategory;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<Vendor> */
final class VendorRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Vendor::class);
    }

    public function findOneInOrganisation(Organisation $organisation, string $id): ?Vendor
    {
        return Uuid::isValid($id) ? $this->findOneBy(['id' => $id, 'organisation' => $organisation]) : null;
    }

    /**
     * A to Z ignoring case and accents; a name containing the typed text, ignoring case, with accents as typed.
     *
     * @return array{vendors: list<Vendor>, total: int} the total is every match, not only this page's
     */
    public function findPage(Organisation $organisation, bool $archived, string $typed, ?VendorCategory $category, int $first, int $most): array
    {
        $matching = $this->inView($organisation, $archived);

        if ('' !== $typed) {
            $matching->andWhere('LOWER(v.name) LIKE LOWER(:typed)')->setParameter('typed', NameSearch::anywhere($typed));
        }

        if (null !== $category) {
            $matching->andWhere('v.category = :category')->setParameter('category', $category);
        }

        $total = Type\int()->coerce((clone $matching)->select('COUNT(v.id)')->getQuery()->getSingleScalarResult());

        return [
            'vendors' => Type\vec(Type\instance_of(Vendor::class))->coerce($matching
                ->addSelect('FOLDED(v.name) AS HIDDEN folded')
                ->orderBy('folded', 'ASC')
                ->addOrderBy('LOWER(v.name)', 'ASC')
                ->addOrderBy('v.id', 'ASC')
                ->setFirstResult($first)
                ->setMaxResults($most)
                ->getQuery()
                ->getResult()),
            'total' => $total,
        ];
    }

    /** @return array{inUse: int, archived: int, categories: array<string, int>} the categories counted within the view asked for */
    public function countIn(Organisation $organisation, bool $archived): array
    {
        $rows = Type\vec(Type\shape([
            'category' => Type\instance_of(VendorCategory::class),
            'archived' => Type\int(),
            'counted' => Type\int(),
        ]))->coerce($this->createQueryBuilder('v')
            ->select('v.category AS category', 'CASE WHEN v.archivedAt IS NULL THEN 0 ELSE 1 END AS archived', 'COUNT(v.id) AS counted')
            ->where('v.organisation = :organisation')
            ->setParameter('organisation', $organisation->getId(), 'uuid')
            ->groupBy('category', 'archived')
            ->getQuery()
            ->getArrayResult());

        $counts = ['inUse' => 0, 'archived' => 0, 'categories' => []];

        foreach (VendorCategory::cases() as $case) {
            $counts['categories'][$case->value] = 0;
        }

        foreach ($rows as $row) {
            $isArchived = 1 === $row['archived'];
            $counts[$isArchived ? 'archived' : 'inUse'] += $row['counted'];

            if ($isArchived === $archived) {
                $counts['categories'][$row['category']->value] += $row['counted'];
            }
        }

        return $counts;
    }

    private function inView(Organisation $organisation, bool $archived): QueryBuilder
    {
        return $this->createQueryBuilder('v')
            ->where('v.organisation = :organisation')
            ->andWhere($archived ? 'v.archivedAt IS NOT NULL' : 'v.archivedAt IS NULL')
            ->setParameter('organisation', $organisation->getId(), 'uuid');
    }
}
