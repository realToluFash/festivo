<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Domain\Organisation\Plan\PlanChanger;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Enum\Plan;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

/**
 * An organisation on Enterprise that has proved a domain under Email domains (sc-560), without the DNS round trip.
 *
 * @phpstan-require-extends \App\Tests\ApiTestCase
 */
trait ProvesDomains
{
    protected static function proveDomain(Organisation $organisation, string $domain, DateTimeImmutable $at = new DateTimeImmutable()): EmailDomain
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->flush();
        $organisation = $entityManager->find(Organisation::class, $organisation->getId()) ?? self::fail('no such organisation');
        self::service(PlanChanger::class)->change($organisation, Plan::Enterprise, 'Ada at Soirely', 'A test proves a domain.');
        $proved = new EmailDomain($organisation, $domain, 'k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa', $at);
        $proved->found($at);
        $entityManager->persist($proved);
        $entityManager->flush();

        return $proved;
    }
}
