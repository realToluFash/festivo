<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Audit\Auditor;
use App\Entity\AuditEntry;
use App\Entity\SchemaProbe;
use App\Enum\Actor;
use App\Tests\FunctionalTestCase;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use ReflectionClass;
use ReflectionMethod;
use Symfony\Component\Uid\Uuid;

final class AuditTest extends FunctionalTestCase
{
    private EntityManagerInterface $em;
    private Auditor $auditor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->em = self::service(EntityManagerInterface::class);
        $this->auditor = self::service(Auditor::class);
    }

    #[Test]
    public function itRecordsWhatChangedFromAndTo(): void
    {
        $subject = Uuid::v7();

        $this->auditor->record(
            action: 'role.changed',
            subjectType: 'OrgMember',
            subjectId: $subject,
            actorType: Actor::User,
            actorId: Uuid::v7(),
            actorLabel: 'Ada Okonkwo',
            changes: Auditor::diff(['role' => 'coordinator'], ['role' => 'administrator']),
        );
        $this->em->flush();
        $this->em->clear();

        $entry = $this->em->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $subject]);

        self::assertNotNull($entry);
        // Before AND after. "Role changed" is not an answer to "changed from
        // what?", and the before is the half nothing can reconstruct later.
        self::assertSame(['role' => ['coordinator', 'administrator']], $entry->getChanges());
    }

    /**
     * An agent's action that cannot be told apart from the account holder's own
     * is indistinguishable from a breach.
     */
    #[Test]
    public function anAgentIsDistinguishableFromTheAccountHolder(): void
    {
        $subject = Uuid::v7();

        $this->auditor->record(
            action: 'mfa.cleared',
            subjectType: 'Account',
            subjectId: $subject,
            actorType: Actor::Agent,
            actorId: Uuid::v7(),
            actorLabel: 'support: Rowan',
        );
        $this->em->flush();
        $this->em->clear();

        $entry = $this->em->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $subject]);

        self::assertSame(Actor::Agent, $entry?->getActorType());
        self::assertNotSame(Actor::User, $entry?->getActorType());
    }

    /**
     * The actor's name is stored as text, at the time. Resolving it later shows
     * who that id belongs to NOW, which is a different question — and after the
     * account is deleted it answers nothing.
     */
    #[Test]
    public function itKeepsTheActorsNameAsItWas(): void
    {
        $subject = Uuid::v7();
        $this->auditor->record('event.deleted', 'Event', $subject, Actor::User, Uuid::v7(), 'Chief Adaeze Okonkwo');
        $this->em->flush();
        $this->em->clear();

        $entry = $this->em->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $subject]);
        self::assertSame('Chief Adaeze Okonkwo', $entry?->getActorLabel());
    }

    /** The history of a deleted thing is exactly what somebody will ask about. */
    #[Test]
    public function itSurvivesTheSoftDeletionOfItsSubject(): void
    {
        $probe = new SchemaProbe('deleted later');
        $this->em->persist($probe);
        $this->em->flush();

        $this->auditor->record('probe.created', 'SchemaProbe', $probe->getId(), Actor::System);
        $this->em->flush();

        $probe->softDelete();
        $this->em->flush();
        $this->em->clear();

        self::assertNull($this->em->getRepository(SchemaProbe::class)->find($probe->getId()));
        self::assertNotNull(
            $this->em->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $probe->getId()]),
        );
    }

    #[Test]
    public function theSystemNeedsNoIdentity(): void
    {
        $subject = Uuid::v7();
        $this->auditor->record('retention.purged', 'Guest', $subject);
        $this->em->flush();
        $this->em->clear();

        $entry = $this->em->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $subject]);
        self::assertSame(Actor::System, $entry?->getActorType());
        self::assertNull($entry?->getActorId());
    }

    /**
     * An entry the application can edit answers "who changed this" with
     * "somebody who could also change the answer".
     */
    #[Test]
    public function anEntryExposesNoWayToAlterIt(): void
    {
        $reflection = new ReflectionClass(AuditEntry::class);

        $mutators = \array_filter(
            $reflection->getMethods(ReflectionMethod::IS_PUBLIC),
            static fn (ReflectionMethod $m): bool => \str_starts_with($m->getName(), 'set')
                || \str_starts_with($m->getName(), 'with'),
        );

        self::assertSame([], \array_map(static fn ($m) => $m->getName(), $mutators));
    }

    /** Recording unchanged fields makes a diff nobody reads. */
    #[Test]
    public function theDiffKeepsOnlyWhatActuallyDiffers(): void
    {
        $changes = Auditor::diff(
            ['name' => 'Ada', 'role' => 'coordinator', 'email' => 'a@example.com'],
            ['name' => 'Ada', 'role' => 'administrator', 'email' => 'a@example.com'],
        );

        self::assertSame(['role' => ['coordinator', 'administrator']], $changes);
    }

    #[Test]
    public function theDiffReportsAFieldThatAppearedOrVanished(): void
    {
        self::assertSame(['phone' => [null, '+447700900123']], Auditor::diff([], ['phone' => '+447700900123']));
        self::assertSame(['phone' => ['+447700900123', null]], Auditor::diff(['phone' => '+447700900123'], []));
    }
}
