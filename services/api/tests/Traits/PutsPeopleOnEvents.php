<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\EventRole;
use PHPUnit\Framework\Assert;

/**
 * A member given a role on one event (sc-29912), the way People would.
 *
 * @phpstan-require-extends \App\Tests\ApiTestCase
 */
trait PutsPeopleOnEvents
{
    protected static function onEvent(User $user, string $eventId, EventRole $role): EventPerson
    {
        $em = self::em();
        $event = $em->find(Event::class, $eventId) ?? Assert::fail('no event');
        $membership = $em->getRepository(Membership::class)->findOneBy(['user' => $user->getId(), 'organisation' => $event->getOrganisation()]) ?? Assert::fail('not a member');
        $person = new EventPerson($event, $membership, $role, null);
        $em->persist($person);
        $em->flush();

        return $person;
    }
}
