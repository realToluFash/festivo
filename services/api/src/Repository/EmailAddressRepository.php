<?php

declare(strict_types=1);

namespace App\Repository;

use App\Domain\User\EmailAddressNormaliser;
use App\Entity\EmailAddress;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<EmailAddress> */
final class EmailAddressRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EmailAddress::class);
    }

    public function findOneByAddress(string $address): ?EmailAddress
    {
        return $this->findOneBy(['address' => EmailAddressNormaliser::normalise($address)]);
    }
}
