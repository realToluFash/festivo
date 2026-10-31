<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Repository\EmailAddressRepository;
use App\Repository\UserRepository;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use PHPUnit\Framework\Attributes\Test;

/**
 * A person may link more than one email address and more than one phone number.
 *
 * That decision is why neither lives on `users` as a column, and these are the
 * four things that stop being true if somebody moves them back.
 */
final class LinkedAddressesTest extends FunctionalTestCase
{
    /**
     * A literal password, which a registration test cannot do without. The rule
     * is right everywhere else.
     *
     * @mago-expect lint:no-literal-password
     */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function registeringLinksOneAddressAndMakesItPrimary(): void
    {
        $user = $this->register('first@example.com');

        self::assertCount(1, $user->getEmailAddresses());
        self::assertSame('first@example.com', $user->getPrimaryEmailAddress()?->getAddress());
        self::assertTrue($user->getPrimaryEmailAddress()?->isPrimary());
    }

    #[Test]
    public function aSecondAddressCanBeLinkedWithoutDisturbingTheFirst(): void
    {
        $user = $this->register('work@example.com');

        new EmailAddress($user, 'personal@example.com');
        self::em()->flush();
        self::em()->clear();

        $reloaded = self::service(UserRepository::class)->findOneByPrimaryEmailAddress('work@example.com');
        self::assertNotNull($reloaded);
        self::assertCount(2, $reloaded->getEmailAddresses());
        self::assertSame('work@example.com', $reloaded->getPrimaryEmailAddress()?->getAddress());
    }

    /**
     * An alternative address is a way to reach somebody, not a second way to
     * be them. It must not sign anybody in, or adding one to your account
     * quietly mints a second set of credentials for it.
     */
    #[Test]
    public function onlyThePrimaryAddressIdentifiesTheAccount(): void
    {
        $user = $this->register('primary@example.com');
        new EmailAddress($user, 'alternative@example.com');
        self::em()->flush();
        self::em()->clear();

        $users = self::service(UserRepository::class);

        self::assertNotNull($users->findOneByPrimaryEmailAddress('PRIMARY@Example.com '));
        self::assertNull(
            $users->findOneByPrimaryEmailAddress('alternative@example.com'),
            'an alternative address is not a way to sign in',
        );
        self::assertNull($users->findOneByPrimaryEmailAddress('nobody@example.com'));
    }

    /**
     * But "is this address already taken" is a different question from "whose
     * account is this", and it has to span every address — otherwise somebody
     * can register with an address that is already somebody else's
     * alternative, and only the unique constraint catches it.
     */
    #[Test]
    public function anAlternativeAddressIsStillClaimed(): void
    {
        $user = $this->register('taken-primary@example.com');
        new EmailAddress($user, 'taken-alternative@example.com');
        self::em()->flush();
        self::em()->clear();

        $addresses = self::service(EmailAddressRepository::class);

        self::assertNotNull($addresses->findOneByAddress('taken-primary@example.com'));
        self::assertNotNull($addresses->findOneByAddress('TAKEN-ALTERNATIVE@example.com'));
        self::assertNull($addresses->findOneByAddress('free@example.com'));
    }

    /**
     * Globally unique, not per user. Two accounts claiming one address is how a
     * password reset reaches the wrong person.
     */
    #[Test]
    public function twoAccountsCannotClaimTheSameAddress(): void
    {
        $this->register('contested@example.com');

        $other = new User('Other');
        new EmailAddress($other, 'contested@example.com', isPrimary: true);
        self::em()->persist($other);

        $this->expectException(UniqueConstraintViolationException::class);
        self::em()->flush();
    }

    /** The partial index, which is the only thing enforcing "one primary". */
    #[Test]
    public function aUserCannotHaveTwoPrimaryAddresses(): void
    {
        $user = $this->register('one@example.com');

        new EmailAddress($user, 'two@example.com', isPrimary: true);

        $this->expectException(UniqueConstraintViolationException::class);
        self::em()->flush();
    }

    #[Test]
    public function aUserCannotHaveTwoPrimaryPhoneNumbers(): void
    {
        $user = $this->register('phones@example.com');

        new PhoneNumber($user, '+447700900001', isPrimary: true);
        new PhoneNumber($user, '+447700900002', isPrimary: true);

        $this->expectException(UniqueConstraintViolationException::class);
        self::em()->flush();
    }

    /**
     * The gate reads the primary address, not any verified one. Somebody who
     * verifies a second address has still not proved the one they registered
     * with.
     */
    #[Test]
    public function verificationIsAskedOfThePrimaryAddress(): void
    {
        $user = $this->register('gate@example.com');

        $second = new EmailAddress($user, 'other@example.com');
        $second->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();

        self::assertFalse($user->isVerified(), 'a verified second address is not the primary one');

        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();

        self::assertTrue($user->isVerified());
    }

    /**
     * An unverified phone blocks the gate; no phone at all does not. An account
     * from a provider legitimately has none, and a gate written as "the phone
     * must be verified" locks all of them out.
     */
    #[Test]
    public function anUnverifiedPrimaryPhoneBlocksTheGateButNoPhoneDoesNot(): void
    {
        $user = $this->register('phone-gate@example.com');
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();

        self::assertTrue($user->isVerified(), 'no phone is acceptable');

        $phone = new PhoneNumber($user, '+447700900003', isPrimary: true);
        self::em()->flush();

        self::assertFalse($user->isVerified(), 'an unverified phone is not');

        $phone->setVerifiedAt(new DateTimeImmutable());
        self::em()->flush();

        self::assertTrue($user->isVerified());
    }

    #[Test]
    public function deletingAUserTakesItsAddressesWithIt(): void
    {
        $user = $this->register('cascade@example.com');
        new PhoneNumber($user, '+447700900004', isPrimary: true);
        self::em()->flush();

        self::em()->remove($user);
        self::em()->flush();

        $counts = self::em()->getConnection();

        self::assertSame(
            0,
            (int) $counts->executeQuery('SELECT COUNT(*) FROM email_addresses')->fetchOne(),
        );
        self::assertSame(
            0,
            (int) $counts->executeQuery('SELECT COUNT(*) FROM phone_numbers')->fetchOne(),
        );
    }

    private function register(string $address): User
    {
        $result = self::service(UserRegistrar::class)->register($address, 'Linked', self::PASSWORD);
        self::em()->flush();

        return $result->user;
    }
}
