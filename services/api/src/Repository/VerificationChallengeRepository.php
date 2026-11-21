<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EmailAddress;
use App\Entity\VerifiableContact;
use App\Entity\VerificationChallenge;
use App\Enum\PhoneCodeRoute;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Str;
use Psl\Type;

/** @extends ServiceEntityRepository<VerificationChallenge> */
final class VerificationChallengeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, VerificationChallenge::class);
    }

    /** At most one, by the partial unique index on unrevoked rows. */
    public function findLiveFor(VerifiableContact $contact): ?VerificationChallenge
    {
        return $this->findOneBy([self::field($contact) => $contact, 'revokedAt' => null]);
    }

    /** By id rather than `created_at`: a v7 id orders two challenges issued in the same second. */
    public function findNewestFor(VerifiableContact $contact): ?VerificationChallenge
    {
        return $this->findOneBy([self::field($contact) => $contact], ['id' => 'DESC']);
    }

    public function revokeLiveFor(VerifiableContact $contact): void
    {
        $this->getEntityManager()
            ->createQuery(Str\format(
                'UPDATE App\Entity\VerificationChallenge c SET c.revokedAt = :now, c.sealedCode = NULL WHERE c.%s = :contact AND c.revokedAt IS NULL',
                self::field($contact),
            ))
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('contact', $contact)
            ->execute();
    }

    /** In the database, so wrong codes sent at once each count; the entity is refreshed to the result. */
    public function recordWrongAttempt(VerificationChallenge $challenge): void
    {
        $this->getEntityManager()
            ->createQuery('UPDATE App\Entity\VerificationChallenge c SET c.attempts = c.attempts + 1 WHERE c.id = :id')
            ->setParameter('id', $challenge->getId(), 'uuid')
            ->execute();

        $this->getEntityManager()->refresh($challenge);

        if ($challenge->isExhausted() && null !== $challenge->getSealedCode()) {
            $this->getEntityManager()
                ->createQuery('UPDATE App\Entity\VerificationChallenge c SET c.sealedCode = NULL WHERE c.id = :id')
                ->setParameter('id', $challenge->getId(), 'uuid')
                ->execute();
            $this->getEntityManager()->refresh($challenge);
        }
    }

    /** @return int how many codes no longer live were still kept sealed, and now are not */
    public function forgetLapsedCodes(): int
    {
        return Type\int()->coerce($this->getEntityManager()
            ->createQuery('UPDATE App\Entity\VerificationChallenge c SET c.sealedCode = NULL WHERE c.sealedCode IS NOT NULL AND (c.expiresAt <= :now OR c.revokedAt IS NOT NULL OR c.attempts >= :maximum)')
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->setParameter('maximum', VerificationChallenge::MAXIMUM_ATTEMPTS)
            ->execute());
    }

    private static function field(VerifiableContact $contact): string
    {
        return $contact instanceof EmailAddress ? 'emailAddress' : 'phoneNumber';
    }

    /** @return list<VerificationChallenge> live codes still on WhatsApp, sent before the given moment */
    public function findAwaitingWhatsAppSince(DateTimeImmutable $before): array
    {
        return Type\vec(Type\instance_of(VerificationChallenge::class))->coerce($this->createQueryBuilder('c')
            ->where('c.route = :route AND c.sealedCode IS NOT NULL AND c.createdAt <= :before AND c.expiresAt > :now AND c.revokedAt IS NULL')
            ->setParameter('route', PhoneCodeRoute::WhatsApp->value)
            ->setParameter('before', $before, Types::DATETIME_IMMUTABLE)
            ->setParameter('now', new DateTimeImmutable(), Types::DATETIME_IMMUTABLE)
            ->getQuery()
            ->getResult());
    }
}
