<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\NotificationScheduler;
use App\Domain\Messaging\NotificationWorker;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventType;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\Double\Messaging\RecordingEmailSender;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

abstract class MessagingTestCase extends FunctionalTestCase
{
    protected Organisation $organisation;

    protected User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = $this->account('owner');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Notified Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    protected static function em(): EntityManagerInterface
    {
        return self::service(EntityManagerInterface::class);
    }

    protected static function connection(): Connection
    {
        return self::service(Connection::class);
    }

    protected static function scheduler(): NotificationScheduler
    {
        return self::service(NotificationScheduler::class);
    }

    protected static function worker(): NotificationWorker
    {
        return self::service(NotificationWorker::class);
    }

    protected static function sender(): RecordingEmailSender
    {
        return self::service(RecordingEmailSender::class);
    }

    protected static function runUntilIdle(int $atMost = 100): int
    {
        $steps = 0;

        while ($steps < $atMost && self::worker()->step()) {
            ++$steps;
        }

        return $steps;
    }

    protected function account(string $name): User
    {
        $user = self::service(UserRegistrar::class)->registerConfirmed(Str\format('%s.%s@example.test', $name, Str\lowercase(Uuid::v4()->toBase32())), Str\uppercase($name), 'hash')->user;
        self::em()->flush();

        return $user;
    }

    protected function member(string $name, SeededRole $seeded): User
    {
        $user = $this->account($name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($this->organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    protected function event(string $startsIn = '+10 days'): Event
    {
        $zone = new DateTimeZone('Africa/Lagos');
        $starts = new DateTimeImmutable($startsIn, $zone)->setTime(18, 0);
        $event = new Event($this->organisation, 'Gala', EventType::Wedding, $starts, $starts->modify('+5 hours'), 'NGN');
        self::em()->persist($event);
        self::em()->flush();

        return $event;
    }

    /** @return list<string> the names of whoever was sent anything, in order */
    protected static function sentTo(): array
    {
        return Vec\map(self::sender()->sent, static fn (array $sent): string => $sent['recipient']->name);
    }

    /** @param array<string, mixed> $parameters */
    protected static function scalar(string $sql, array $parameters = []): mixed
    {
        return self::connection()->fetchOne($sql, $parameters);
    }

    /** @param array<string, mixed> $parameters */
    protected static function rowCount(string $sql, array $parameters = []): int
    {
        return Type\int()->coerce(self::scalar($sql, $parameters));
    }
}
