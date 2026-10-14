<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\SchemaProbe;
use App\Tests\FunctionalTestCase;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;

/**
 * The two promises the test database makes.
 *
 * Both are the sort of thing everybody assumes and nobody checks, and the cost
 * of either being false is a developer losing their local data to a test run.
 */
final class DatabaseIsolationTest extends FunctionalTestCase
{
    #[Test]
    public function theSuiteRunsAgainstADatabaseNamedForTesting(): void
    {
        $em = self::service(EntityManagerInterface::class);

        $name = $em->getConnection()->getDatabase();

        self::assertNotNull($name);
        self::assertStringEndsWith('_test', $name, 'The suite is pointed at a non-test database');
    }

    #[Test]
    public function entityMappingReachesARealTable(): void
    {
        $em = self::service(EntityManagerInterface::class);

        $probe = new SchemaProbe('written by the suite');
        $em->persist($probe);
        $em->flush();
        $em->clear();

        $found = $em->getRepository(SchemaProbe::class)->find($probe->id());

        self::assertNotNull($found);
        self::assertSame('written by the suite', $found->label());
    }

    /**
     * Each test is wrapped in a transaction that is rolled back, so a row
     * written by the test above is not here. Without this, tests pass in
     * isolation and fail in a suite — or worse, pass in a suite because of
     * something an earlier test left behind.
     */
    #[Test]
    public function nothingAPreviousTestWroteSurvivesIntoThisOne(): void
    {
        $em = self::service(EntityManagerInterface::class);

        $rows = $em->getRepository(SchemaProbe::class)->findBy(['label' => 'written by the suite']);

        self::assertCount(0, $rows, 'A row from a previous test leaked into this one');
    }
}
