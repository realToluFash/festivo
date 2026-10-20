<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\Invitation;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\SeededRole;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psl\Type;

/**
 * An invitation written straight to the database, for tests about what happens once one exists.
 *
 * @phpstan-require-extends \Symfony\Bundle\FrameworkBundle\Test\KernelTestCase
 */
trait InvitesPeople
{
    use ServiceAccessTrait;

    /** @mago-expect lint:no-literal-password */
    private const string INVITER_PASSWORD = 'an inviter passphrase';

    /** @return array{Invitation, string} the invitation, and the plain token its link carries */
    protected static function invitationTo(string $email, ?Organisation $organisation = null, SeededRole $as = SeededRole::EventManager): array
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $organisation ??= self::organisationFor(self::inviter('inviter-' . \bin2hex(SecureRandom\bytes(4)) . '@example.com'));
        $role = Type\instance_of(Role::class)->coerce($entityManager->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]));
        $owner = $entityManager->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Owner]);
        $inviter = $entityManager->createQuery('SELECT u FROM ' . User::class . ' u JOIN App\Entity\Membership m WITH m.user = u WHERE m.role = :owner')
            ->setParameter('owner', $owner)
            ->setMaxResults(1)
            ->getSingleResult();

        $token = \bin2hex(SecureRandom\bytes(32));
        $invitation = new Invitation(
            $organisation,
            $email,
            $role,
            Type\instance_of(User::class)->coerce($inviter),
            TokenIssuer::hash($token),
            new DateTimeImmutable()->modify('+7 days'),
        );
        $entityManager->persist($invitation);
        $entityManager->flush();

        return [$invitation, $token];
    }

    protected static function inviter(string $email, string $name = 'Bisi Adeyemi'): User
    {
        $user = self::service(UserRegistrar::class)->register($email, $name, self::INVITER_PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        $user->markDetailsSaved();
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    protected static function organisationFor(User $owner, string $name = 'Ìrè Events'): Organisation
    {
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return $organisation;
    }
}
