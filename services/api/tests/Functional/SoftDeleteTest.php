<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\SchemaProbe;
use App\Tests\FunctionalTestCase;
use DateInterval;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Uid\Uuid;

final class SoftDeleteTest extends FunctionalTestCase
{
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        parent::setUp();
        $this->em = self::service(EntityManagerInterface::class);
    }

    /**
     * The default has to be absence. Excluding deleted rows at each query is a
     * rule every read must remember, and the one that forgets leaks a deleted
     * guest into a list — which reads as the deletion not having worked.
     */
    #[Test]
    public function aDeletedRowIsAbsentFromAnOrdinaryRead(): void
    {
        $probe = $this->persist('visible then not');
        $id = $probe->getId();

        self::assertNotNull($this->em->getRepository(SchemaProbe::class)->find($id));

        $probe->softDelete();
        $this->em->flush();
        $this->em->clear();

        self::assertNull($this->em->getRepository(SchemaProbe::class)->find($id));
    }

    #[Test]
    public function aDeletedRowIsAbsentFromACollectionReadToo(): void
    {
        $kept = $this->persist('kept');
        $gone = $this->persist('gone');
        $gone->softDelete();
        $this->em->flush();
        $this->em->clear();

        $labels = \array_map(
            static fn (SchemaProbe $p): string => $p->getLabel(),
            $this->em->getRepository(SchemaProbe::class)->findAll(),
        );

        self::assertContains($kept->getLabel(), $labels);
        self::assertNotContains($gone->getLabel(), $labels);
    }

    /**
     * It is still there. Support restoring something is the entire reason for
     * a soft delete, and that requires being able to see it.
     */
    #[Test]
    public function itCanStillBeFoundWhenTheFilterIsExplicitlyDisabled(): void
    {
        $probe = $this->persist('findable by an agent');
        $id = $probe->getId();
        $probe->softDelete();
        $this->em->flush();
        $this->em->clear();

        $this->em->getFilters()->disable('soft_delete');
        $found = $this->em->getRepository(SchemaProbe::class)->find($id);
        $this->em->getFilters()->enable('soft_delete');

        self::assertNotNull($found);
        self::assertTrue($found->isDeleted());
    }

    #[Test]
    public function restoringBringsItBackIntoOrdinaryReads(): void
    {
        $probe = $this->persist('restored');
        $id = $probe->getId();
        $probe->softDelete();
        $this->em->flush();

        $probe->restore();
        $this->em->flush();
        $this->em->clear();

        $found = $this->em->getRepository(SchemaProbe::class)->find($id);
        self::assertNotNull($found);
        self::assertFalse($found->isDeleted());
    }

    #[Test]
    public function itRecordsWhoDeletedIt(): void
    {
        $who = Uuid::v7();
        $probe = $this->persist('deleted by somebody');
        $probe->softDelete($who);
        $this->em->flush();

        self::assertTrue($probe->deletedBy()?->equals($who));
        self::assertNotNull($probe->deletedAt());
    }

    /**
     * The window is a grace period, not a lawful basis for keeping data. An
     * erasure request hard-deletes regardless, and the purge job needs to know
     * which rows are past it.
     */
    #[Test]
    public function itKnowsWhenItsRecoveryWindowHasPassed(): void
    {
        $probe = $this->persist('ages ago');
        $probe->softDelete();

        $window = new DateInterval('P30D');

        self::assertFalse($probe->isPurgeable($window));
        self::assertTrue($probe->isPurgeable($window, new DateTimeImmutable('+31 days')));
    }

    #[Test]
    public function aRowThatWasNeverDeletedIsNeverPurgeable(): void
    {
        $probe = $this->persist('alive');

        self::assertFalse($probe->isPurgeable(new DateInterval('P1D'), new DateTimeImmutable('+10 years')));
    }

    private function persist(string $label): SchemaProbe
    {
        $probe = new SchemaProbe($label);
        $this->em->persist($probe);
        $this->em->flush();

        return $probe;
    }
}
