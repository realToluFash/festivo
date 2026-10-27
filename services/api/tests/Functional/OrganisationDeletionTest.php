<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Pruner;
use App\Deletion\Restorer;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\DeletedKind;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Mime\Email;

final class OrganisationDeletionTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use InvitesPeople;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string DELETED_AT = '2026-10-17T13:20:00+00:00';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable(self::DELETED_AT));
        $this->owner = $this->account('folake@ire.events', 'Folake Adeyemi', 'Africa/Lagos');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function theConfirmationCountsWhatGoesAndSaysUntilWhenSupportCanRestoreIt(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);

        $body = $this->as($this->owner, 'GET', $this->path('/deletion'));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(
            ['events' => 0, 'guests' => 0, 'members' => 2, 'restoreClosesAt' => '2026-11-16T13:20:00+00:00', 'restoreCloses' => 'Monday 16 Nov at 14:20 WAT'],
            $body,
        );
    }

    /** sc-16866: only the members who are in. */
    #[Test]
    public function theConfirmationCountsOnlyActiveMembers(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->member('tunde@ire.events', 'Tunde Bakare', SeededRole::Coordinator);
        $this->member('ada@ire.events', 'Ada Obi', SeededRole::Coordinator, status: MembershipStatus::PendingApproval);
        $this->member('kemi@ire.events', 'Kemi Ola', SeededRole::Coordinator, status: MembershipStatus::Suspended);
        $this->member('femi@ire.events', 'Femi Ade', SeededRole::Coordinator, status: MembershipStatus::LeftOrRemoved);

        $body = $this->as($this->owner, 'GET', $this->path('/deletion'));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(3, $body['members']);
    }

    /** One instant, written in each reader's zone: London is on GMT by then though the deletion happened in BST. */
    #[Test]
    #[DataProvider('readers')]
    public function theRestoreDeadlineIsOneInstantInEveryZone(?string $zone, string $written): void
    {
        $owner = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        $owner->setTimezone($zone);
        self::em()->flush();

        $body = $this->delete($this->owner, 'Ìrè Events');

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame([self::DELETED_AT, '2026-11-16T13:20:00+00:00', $written], [$body['deletedAt'], $body['restoreClosesAt'], $body['restoreCloses']]);
    }

    /** sc-9267: written in the language the request asks for, not the one the owner saved. */
    #[Test]
    public function theRestoreDeadlineIsWrittenInTheLanguageTheRequestAsksFor(): void
    {
        $owner = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        $owner->setLocale('pt');
        self::em()->flush();
        $this->client->setServerParameter('HTTP_ACCEPT_LANGUAGE', 'es');

        $previewed = $this->as($this->owner, 'GET', $this->path('/deletion'));
        $deleted = $this->delete($this->owner, 'Ìrè Events');

        $written = static fn (string $locale): string => self::service(UserMailer::class)->deadline(new DateTimeImmutable('2026-11-16T13:20:00+00:00'), $owner, $locale);
        self::assertSame([$written('es'), $written('es')], [$previewed['restoreCloses'], $deleted['restoreCloses']]);
        self::assertNotSame($written('pt'), $written('es'));
    }

    /** @return iterable<string, array{?string, string}> */
    public static function readers(): iterable
    {
        yield 'Lagos' => ['Africa/Lagos', 'Monday 16 Nov at 14:20 WAT'];
        yield 'London' => ['Europe/London', 'Monday 16 Nov at 13:20 GMT'];
        yield 'no zone' => [null, 'Monday 16 Nov at 13:20 UTC'];
    }

    /** @return iterable<string, array{string}> */
    public static function mismatches(): iterable
    {
        yield 'another case' => ['ìrè events'];
        yield 'another name' => ['Ire Events'];
        yield 'blank' => ['   '];
    }

    #[Test]
    #[DataProvider('mismatches')]
    public function aNameNotTypedExactlyDeletesNothing(string $typed): void
    {
        $body = $this->delete($this->owner, $typed);

        self::assertSame(422, $this->statusCode(), Json\encode($body));
        self::assertSame('Type Ìrè Events exactly as shown to delete it.', $this->violation('name'));
        self::assertSame(200, $this->permissionsStatus($this->owner));
    }

    #[Test]
    public function spacesAroundTheNameAreIgnored(): void
    {
        $this->delete($this->owner, '  Ìrè Events ');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aCurlyApostropheMatchesAStraightOneAndTheAccentsMayBeDecomposed(): void
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $organisation->setName("Ìrè's Events");
        self::em()->flush();

        $this->delete($this->owner, "I\u{0300}re\u{0300}\u{2019}s Events");

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function onlyAnOwnerDeletes(): void
    {
        $admin = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $coordinator = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->delete($admin, 'Ìrè Events');
        self::assertSame(ErrorCode::OwnerRequired->type(), $this->last()['type'] ?? null);
        self::assertSame('Only an owner can delete the organisation.', $this->last()['detail'] ?? null);
        $this->as($admin, 'GET', $this->path('/deletion'));
        self::assertSame(403, $this->statusCode());

        $this->delete($coordinator, 'Ìrè Events');
        self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);

        self::assertSame(200, $this->permissionsStatus($this->owner));
    }

    #[Test]
    public function aDeletedOrganisationIsRefusedToEveryMemberAtOnce(): void
    {
        $admin = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->found($this->owner, 'Elsewhere');
        $this->found($admin, 'Bisi Events');

        $this->delete($this->owner, 'Ìrè Events');

        foreach ([$this->owner, $admin] as $member) {
            self::assertSame(404, $this->permissionsStatus($member));
            $this->as($member, 'GET', $this->path('/roles'));
            self::assertSame(404, $this->statusCode());
            self::assertNotContains($this->organisation->getId()->toRfc4122(), $this->organisationsOf($member));
        }
    }

    #[Test]
    public function aPendingInvitationIntoItIsRefusedWithoutHidingTheOthersAndComesBackWithTheRestore(): void
    {
        $dayo = self::inviter('dayo@ire.events', 'Dayo Bello');
        [$invitation, $token] = self::invitationTo('dayo@ire.events', $this->organisation);
        [$elsewhere] = self::invitationTo('dayo@ire.events', $this->found($this->owner, 'Elsewhere'));
        $this->delete($this->owner, 'Ìrè Events');
        self::em()->clear();

        self::assertSame([$elsewhere->getId()->toRfc4122()], $this->invitationsOf($dayo));
        $link = $this->as($dayo, 'POST', '/api/invitations/link', ['token' => $token]);
        self::assertSame(['organisation_deleted', 'Ìrè Events'], [$link['refusal'] ?? null, Type\shape(['name' => Type\string()], true)->coerce($link['organisation'])['name']]);
        foreach (['accept', 'decline'] as $answer) {
            $body = $this->as($dayo, 'POST', '/api/invitations/' . $invitation->getId()->toRfc4122() . '/' . $answer);
            self::assertSame(410, $this->statusCode(), $answer);
            self::assertSame(ErrorCode::OrganisationDeleted->type(), $body['type'] ?? null, $answer);
        }

        $this->restore('Adaeze from support');

        self::assertSame([$elsewhere->getId()->toRfc4122(), $invitation->getId()->toRfc4122()], $this->invitationsOf($dayo));
    }

    #[Test]
    public function everyMemberIsToldInTheirOwnZone(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator, 'Europe/London');

        $this->delete($this->owner, 'Ìrè Events');

        $mails = Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && 'Ìrè Events has been deleted' === $message->getSubject());
        $to = Vec\sort(Vec\map($mails, static fn (object $mail): string => Type\instance_of(Email::class)->coerce($mail)->getTo()[0]->getAddress()));
        self::assertSame(['bisi@ire.events', 'folake@ire.events'], $to);
        $toBisi = Type\instance_of(Email::class)->coerce(Iter\first(Vec\filter($mails, static fn (object $mail): bool => 'bisi@ire.events' === Type\instance_of(Email::class)->coerce($mail)->getTo()[0]->getAddress())));
        self::assertStringContainsString('Soirely support can restore it until Monday 16 Nov at 13:20 GMT; after that it is gone for good.', (string) $toBisi->getTextBody());
        self::assertStringContainsString('Folake Adeyemi deleted Ìrè Events', (string) $toBisi->getTextBody());
    }

    /** Regression: signing in, and the account's other organisations, are untouched by a deletion. */
    #[Test]
    public function signingInAndTheOtherOrganisationsKeepWorking(): void
    {
        $elsewhere = $this->found($this->owner, 'Elsewhere');

        $this->delete($this->owner, 'Ìrè Events');

        $this->client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['email' => 'folake@ire.events', 'password' => self::PASSWORD]));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([$elsewhere->getId()->toRfc4122()], $this->organisationsOf($this->owner));
        $this->as($this->owner, 'GET', '/api/orgs/' . $elsewhere->getId()->toRfc4122() . '/roles');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function theDeletionIsRecordedWithWhoAndWhen(): void
    {
        $this->delete($this->owner, 'Ìrè Events');

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'organisation.deleted', 'subjectId' => $this->organisation->getId()]);
        self::assertSame([Actor::User, $this->owner->getId()->toRfc4122(), 'Folake Adeyemi'], [$entry?->getActorType(), $entry?->getActorId()?->toRfc4122(), $entry?->getActorLabel()]);
        self::assertSame(['deletedAt' => [null, self::DELETED_AT]], $entry?->getChanges());
    }

    #[Test]
    public function supportRestoresItWholeInsideTheWindow(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $before = $this->as($bisi, 'GET', $this->path('/permissions'));
        $this->delete($this->owner, 'Ìrè Events');

        self::mockTime(new DateTimeImmutable('2026-11-16T13:19:59+00:00'));
        $this->restore('Adaeze from support');

        self::assertSame($before, $this->as($bisi, 'GET', $this->path('/permissions')));
        self::assertSame(200, $this->permissionsStatus($this->owner));
        self::assertSame(['owner', 'administrator', 'event_manager', 'coordinator', 'read_only'], Vec\map(
            Type\vec(Type\shape(['seededAs' => Type\nullable(Type\string())], true))->coerce($this->as($this->owner, 'GET', $this->path('/roles'))['roles']),
            static fn (array $role): ?string => $role['seededAs'],
        ));
        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'organisation.restored', 'subjectId' => $this->organisation->getId()]);
        self::assertSame([Actor::Agent, 'Adaeze from support'], [$entry?->getActorType(), $entry?->getActorLabel()]);
    }

    #[Test]
    public function nothingIsRestorableFromTheInstantTheWindowCloses(): void
    {
        $this->delete($this->owner, 'Ìrè Events');

        self::mockTime(new DateTimeImmutable('2026-11-16T13:20:00+00:00'));

        try {
            $this->restore('Adaeze from support');
            self::fail('restored after the window closed');
        } catch (RuntimeException $e) {
            self::assertStringContainsString('cannot be restored', $e->getMessage());
        }

        self::assertSame(ErrorCode::NotFound->type(), $this->as($this->owner, 'GET', $this->path('/permissions'))['type'] ?? null);
    }

    /** It lands where an account with no organisation does, never back on the details screen. */
    #[Test]
    public function anAccountWhoseOnlyOrganisationIsDeletedStaysComplete(): void
    {
        $this->delete($this->owner, 'Ìrè Events');

        self::assertSame([], $this->as($this->owner, 'GET', '/api/orgs')['organisations'] ?? null);
        self::assertTrue($this->as($this->owner, 'GET', '/api/auth/me')['complete'] ?? null);
    }

    #[Test]
    public function theRestoreCommandNamesTheAgentAndRefusesOutsideTheWindow(): void
    {
        $this->delete($this->owner, 'Ìrè Events');
        $command = new CommandTester(new Application(self::$kernel ?? throw new LogicException('No kernel.'))->find('app:restore-organisation'));

        self::assertSame(1, $command->execute(['organisation' => $this->organisation->getId()->toRfc4122()]));
        self::assertSame(0, $command->execute(['organisation' => $this->organisation->getId()->toRfc4122(), '--agent' => 'Adaeze from support']));
        self::assertSame(1, $command->execute(['organisation' => $this->organisation->getId()->toRfc4122(), '--agent' => 'Adaeze from support']), 'not deleted any more');
    }

    #[Test]
    public function theDeletionCascadesWhenTheWindowClosesAndNotBefore(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->delete($this->owner, 'Ìrè Events');
        $pruner = self::service(Pruner::class);

        self::mockTime(new DateTimeImmutable('2026-11-16T13:19:59+00:00'));
        self::assertSame(0, $pruner->prune());
        self::assertSame(2, $this->rowsIn('memberships'));

        self::mockTime(new DateTimeImmutable('2026-11-16T13:20:00+00:00'));
        self::assertSame(1, $pruner->prune());
        self::assertSame([0, 0, 0], [$this->rowsIn('organisations'), $this->rowsIn('memberships'), $this->rowsIn('roles')]);
        self::assertNotNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'organisation.purged', 'subjectId' => $this->organisation->getId()]));
    }

    private function found(User $user, string $name): Organisation
    {
        $organisation = self::service(OrganisationFounder::class)->found(self::em()->find(User::class, $user->getId()) ?? self::fail('no user'), $name, 'NG', 'Africa/Lagos');
        self::em()->flush();

        return $organisation;
    }

    private function restore(string $agent): void
    {
        self::service(Restorer::class)->restore(DeletedKind::Organisation, $this->organisation->getId(), $agent);
        self::em()->clear();
    }

    private function rowsIn(string $table): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne(
            Str\format('SELECT COUNT(*) FROM %s WHERE %s = :organisation', $table, 'organisations' === $table ? 'id' : 'organisation_id'),
            ['organisation' => $this->organisation->getId()->toRfc4122()],
        ));
    }

    private function account(string $address, string $name, ?string $zone = null): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        $user->setTimezone($zone);
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(
        string $address,
        string $name,
        SeededRole $seeded,
        ?string $zone = 'Africa/Lagos',
        MembershipStatus $status = MembershipStatus::Active,
    ): User {
        $user = $this->account($address, $name, $zone);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        $membership = new Membership($organisation, $user, $role, $status->isEntry() ? $status : MembershipStatus::Active, new DateTimeImmutable());
        if (!$status->isEntry()) {
            $membership->setStatus($status, new DateTimeImmutable());
        }

        self::em()->persist($membership);
        self::em()->flush();

        return $user;
    }

    /** @return array<string, mixed> */
    private function delete(User $user, string $typed): array
    {
        return $this->as($user, 'DELETE', $this->path(''), ['name' => $typed]);
    }

    private function permissionsStatus(User $user): int
    {
        $this->as($user, 'GET', $this->path('/permissions'));

        return $this->statusCode();
    }

    /** @return list<string> */
    private function organisationsOf(User $user): array
    {
        return Vec\map(
            Type\vec(Type\shape(['id' => Type\string()], true))->coerce($this->as($user, 'GET', '/api/orgs')['organisations']),
            static fn (array $organisation): string => $organisation['id'],
        );
    }

    /** @return list<string> */
    private function invitationsOf(User $user): array
    {
        $body = $this->as($user, 'GET', '/api/invitations');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Vec\map(
            Type\vec(Type\shape(['id' => Type\string()], true))->coerce($body['invitations']),
            static fn (array $invitation): string => $invitation['id'],
        );
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . $rest;
    }

    private function violation(string $field): ?string
    {
        foreach (Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []) as $violation) {
            if ($violation['propertyPath'] === $field) {
                return $violation['message'];
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
