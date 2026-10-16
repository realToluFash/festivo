<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\ErrorCode;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\Access\FixtureDirectories;
use App\Tests\Fixtures\Access\FixtureTable;
use App\Tests\Fixtures\Access\FixtureTableRepository;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Str;
use Symfony\Component\Uid\Uuid;

final class OrganisationTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function foundingMakesTheFounderItsOwnerWithDefaultsFromCountryDeviceAndAddress(): void
    {
        $owner = $this->account('folake@ire.events');

        $organisation = $this->found($owner, '  Ìrè Events ', 'ng', 'Africa/Lagos');

        self::assertSame('Ìrè Events', $organisation->getName());
        self::assertSame('NG', $organisation->getCountryCode());
        self::assertSame('NGN', $organisation->getCurrency(), 'the currency follows the country');
        self::assertSame('Africa/Lagos', $organisation->getTimezone(), 'the timezone is the device\'s');
        self::assertSame('folake@ire.events', $organisation->getContactAddress(), 'the contact is the owner\'s address');

        $membership = self::service(MembershipRepository::class)->findActive($owner, $organisation->getId());
        self::assertNotNull($membership);
        self::assertTrue($membership->getRole()->isOwner());
    }

    #[Test]
    public function foundingRefusesEveryBadFieldAtOnce(): void
    {
        $owner = $this->account('bad-fields@example.com');

        try {
            $this->found($owner, '   ', 'QQ', 'Mars/Olympus');
            self::fail('an organisation was founded from nothing');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::ValidationFailed, $e->errorCode);
            self::assertSame(
                ['name', 'countryCode', 'currency', 'timezone'],
                \array_column($e->violations, 'propertyPath'),
            );
        }
    }

    /** Distinguished by how the account was created, not by a later check. */
    #[Test]
    public function anInvitedAccountIsRecordedAsSuchAndGetsNoOrganisation(): void
    {
        $invited = self::service(UserRegistrar::class)
            ->registerFromInvitation('invited@example.com', 'Invited', self::PASSWORD)
            ->user;
        $selfRegistered = $this->account('own@example.com');

        self::assertSame(AccountOrigin::Invitation, $invited->getOrigin());
        self::assertSame(AccountOrigin::SelfRegistered, $selfRegistered->getOrigin());

        self::assertSame([], self::service(MembershipRepository::class)->findActiveFor($invited));
    }

    #[Test]
    public function anEventIsReachableOnlyThroughItsOwnOrganisation(): void
    {
        $owner = $this->account('event-owner@example.com');
        $mine = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $theirs = $this->found($this->account('event-other@example.com'), 'Others', 'NG', 'Africa/Lagos');

        $myEvent = Uuid::v7();
        $theirEvent = Uuid::v7();
        $myTable = new FixtureTable(Uuid::v7(), $myEvent);
        $theirTable = new FixtureTable(Uuid::v7(), $theirEvent);
        FixtureTableRepository::$tables = [$myTable, $theirTable];

        $this->signIn($owner);
        $this->client->disableReboot();
        self::getContainer()->set(EventDirectoryInterface::class, new FixtureDirectories([], [
            $myEvent->toRfc4122() => $mine->getId(),
            $theirEvent->toRfc4122() => $theirs->getId(),
        ]));

        $this->client->request('GET', Str\format('/api/_access/events/%s/tables/%s', $myEvent->toRfc4122(), $myTable->id->toRfc4122()));
        self::assertResponseStatusCodeSame(200);

        $this->client->request('GET', Str\format('/api/_access/events/%s/tables/%s', $theirEvent->toRfc4122(), $theirTable->id->toRfc4122()));
        self::assertResponseStatusCodeSame(404);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    private function found(User $owner, string $name, string $country, string $timezone): Organisation
    {
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, $country, $timezone);
        self::service(EntityManagerInterface::class)->flush();

        return $organisation;
    }

    private function signIn(User $user): void
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );
    }
}
