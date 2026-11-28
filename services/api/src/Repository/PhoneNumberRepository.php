<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PhoneNumber;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PhoneNumber> */
final class PhoneNumberRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PhoneNumber::class);
    }

    /** @param non-empty-string $number E.164 */
    public function findOneByNumber(string $number): ?PhoneNumber
    {
        return $this->findOneBy(['number' => $number]);
    }

    /**
     * @param list<string> $numbers E.164
     *
     * @return list<PhoneNumber> the verified ones among them, with their accounts
     */
    public function findVerifiedAmong(array $numbers): array
    {
        if ([] === $numbers) {
            return [];
        }

        /** @var list<PhoneNumber> */
        return $this->createQueryBuilder('p')
            ->select('p', 'u')
            ->innerJoin('p.user', 'u')
            ->where('p.number IN (:numbers)')
            ->andWhere('p.verifiedAt IS NOT NULL')
            ->setParameter('numbers', $numbers)
            ->getQuery()
            ->getResult();
    }
}
