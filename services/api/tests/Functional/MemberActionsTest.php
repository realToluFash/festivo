<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MemberActions;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\Members\MemberSuspension;
use App\Domain\Organisation\Members\OwnershipTransfer;
use App\Domain\Organisation\Members\TeamSeats;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Enum\Suspension;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Translation\TranslatorInterface;

final class MemberActionsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('folake@ire.events', 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function aDemotedMemberLosesThePermissionOnTheirNextRequest(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $token = $this->token($bisi);
        $this->bearing($token, 'GET', $this->path('/members'));
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($bisi)), ['roleId' => $this->roleId(SeededRole::ReadOnly)]);
        self::assertSame(204, $this->statusCode());

        $body = $this->bearing($token, 'GET', $this->path('/members'));
        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(SeededRole::ReadOnly, $this->roleOf($bisi));
        self::assertSame(1, $this->audited(MemberActions::ROLE_CHANGED));
    }

    #[Test]
    public function nobodyChangesTheirOwnRoleOrRemovesThemselves(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $own = $this->membershipOf($bisi);

        $changed = $this->as($bisi, 'PATCH', $this->path('/members/' . $own), ['roleId' => $this->roleId(SeededRole::Coordinator)]);
        self::assertSame(409, $this->statusCode(), Json\encode($changed));
        self::assertSame(ErrorCode::Conflict->type(), $changed['type'] ?? null);

        $this->as($bisi, 'DELETE', $this->path('/members/' . $own));
        self::assertSame(409, $this->statusCode());
        self::assertSame(SeededRole::Administrator, $this->roleOf($bisi));
    }

    #[Test]
    public function onlyAnOwnerChangesAnOwnersRole(): void
    {
        $this->member('kemi@ire.events', 'Kemi Lawal', SeededRole::Owner);
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);

        $body = $this->as($bisi, 'PATCH', $this->path('/members/' . $this->membershipOf($this->owner)), ['roleId' => $this->roleId(SeededRole::ReadOnly)]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type'] ?? null);
        self::assertSame(SeededRole::Owner, $this->roleOf($this->owner));
    }

    #[Test]
    public function anAdministratorMakesNobodyAnOwner(): void
    {
        $this->role(SeededRole::Administrator)->setPermissions(Permission::cases());
        self::em()->flush();
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $body = $this->as($bisi, 'PATCH', $this->path('/members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId(SeededRole::Owner)]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type'] ?? null);
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
        self::assertSame(0, $this->audited(MemberActions::ROLE_CHANGED));
    }

    #[Test]
    public function anAdministratorWithAProofStillMakesNobodyAnOwner(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $proof = $this->as($bisi, 'POST', '/api/auth/proof', ['password' => self::PASSWORD])['proof'] ?? null;

        $body = $this->as($bisi, 'PATCH', $this->path('/members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId(SeededRole::Owner), 'proof' => $proof]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type'] ?? null);
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
    }

    #[Test]
    public function anOwnerMakesAnotherOwnerOnlyWithARecentProof(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $toOwner = ['roleId' => $this->roleId(SeededRole::Owner)];

        $refused = $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($bisi)), $toOwner);
        self::assertSame(403, $this->statusCode(), Json\encode($refused));
        self::assertSame(ErrorCode::ProofRequired->type(), $refused['type'] ?? null);
        self::assertSame(SeededRole::Administrator, $this->roleOf($bisi));
        self::assertSame(0, $this->audited(MemberActions::ROLE_CHANGED));

        $theirs = $this->as($bisi, 'POST', '/api/auth/proof', ['password' => self::PASSWORD])['proof'] ?? null;
        $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($bisi)), [...$toOwner, 'proof' => $theirs]);
        self::assertSame(403, $this->statusCode());
        self::assertSame(SeededRole::Administrator, $this->roleOf($bisi));

        $proof = $this->as($this->owner, 'POST', '/api/auth/proof', ['password' => self::PASSWORD])['proof'] ?? null;
        $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($bisi)), [...$toOwner, 'proof' => $proof]);
        self::assertSame(204, $this->statusCode());
        $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($chidi)), [...$toOwner, 'proof' => $proof]);
        self::assertSame(204, $this->statusCode());

        self::assertSame([SeededRole::Owner, SeededRole::Owner], [$this->roleOf($bisi), $this->roleOf($chidi)]);
        self::assertSame(2, $this->audited(MemberActions::ROLE_CHANGED));
    }

    #[Test]
    public function nobodyChangesSuspendsOrRemovesAMemberWhoseRoleHoldsWhatTheyLack(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->financeFor($chidi);
        $membership = $this->membershipOf($chidi);
        $audited = $this->audited(MemberActions::ROLE_CHANGED);

        $refusals = [
            ['PATCH', '', ['roleId' => $this->roleId(SeededRole::Coordinator)]],
            ['POST', '/suspend', null],
            ['DELETE', '', null],
        ];

        foreach ($refusals as [$method, $action, $payload]) {
            $body = $this->as($bisi, $method, $this->path('/members/' . $membership . $action), $payload);

            self::assertSame(403, $this->statusCode(), $method . $action);
            self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type'] ?? null, Json\encode($body));
        }
        self::assertSame('Finance', $this->membership($chidi)->getRole()->getName());
        self::assertSame(MembershipStatus::Active, $this->membership($chidi)->getStatus());
        self::assertSame([$audited, 0, 0], [$this->audited(MemberActions::ROLE_CHANGED), $this->audited(MemberSuspension::SUSPENDED), $this->audited(MemberActions::REMOVED)]);
    }

    #[Test]
    public function nobodyRestoresAMemberWhoseRoleHoldsWhatTheyLack(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->financeFor($chidi);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));
        self::assertSame(204, $this->statusCode());

        $body = $this->as($bisi, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type'] ?? null);
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus());
    }

    #[Test]
    public function aRemovedMembersSessionIsRefusedAtOnceAndTheirHistoryKept(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator, withOwn: true);
        $token = $this->token($chidi);
        $this->bearing($token, 'GET', $this->path('/permissions'));
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($chidi)));
        self::assertSame(204, $this->statusCode());

        $refused = $this->bearing($token, 'GET', $this->path('/permissions'));
        self::assertSame(404, $this->statusCode(), Json\encode($refused));
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->bearing($token, 'GET', '/api/orgs')['organisations'] ?? null), 'their own organisation untouched');
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($chidi)->getStatus());

        $list = $this->as($this->owner, 'GET', $this->path('/members'));
        $row = Vec\filter(Type\vec(Type\shape(['user' => Type\shape(['name' => Type\string()], true), 'former' => Type\nullable(Type\string())], true))->coerce($list['members']), static fn (array $one): bool => 'Chidi Okoro' === $one['user']['name']);
        self::assertSame('removed', $row[0]['former'] ?? null);
        self::assertSame(1, $this->audited(MemberActions::REMOVED));
    }

    #[Test]
    public function anAccountRemovedFromItsOnlyOrganisationStaysComplete(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($chidi)));
        self::assertSame(204, $this->statusCode());

        self::assertSame([], $this->as($chidi, 'GET', '/api/orgs')['organisations'] ?? null);
        self::assertTrue($this->as($chidi, 'GET', '/api/auth/me')['complete'] ?? null);
    }

    #[Test]
    public function anAccountInNoOrganisationStartsItsOwnAsOwner(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($chidi)));

        $founded = $this->as($chidi, 'POST', '/api/orgs', ['name' => '  Okoro Weddings ', 'countryCode' => 'gh', 'timezone' => 'Africa/Accra']);

        self::assertSame(201, $this->statusCode(), Json\encode($founded));
        $organisation = Type\shape(['name' => Type\string(), 'currency' => Type\string(), 'role' => Type\shape(['seededAs' => Type\string()], true)], true)->coerce($founded['organisation'] ?? null);
        self::assertSame('Okoro Weddings', $organisation['name']);
        self::assertSame('GHS', $organisation['currency']);
        self::assertSame(SeededRole::Owner->value, $organisation['role']['seededAs']);
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->as($chidi, 'GET', '/api/orgs')['organisations'] ?? null));
    }

    #[Test]
    public function startingOneWithNoNameOrCountrySendsNothing(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($chidi)));

        $refused = $this->as($chidi, 'POST', '/api/orgs', ['name' => ' ', 'countryCode' => '', 'timezone' => 'Africa/Lagos']);

        self::assertSame(422, $this->statusCode());
        $paths = \array_column(Type\vec(Type\dict(Type\string(), Type\string()))->coerce($refused['violations'] ?? null), 'propertyPath');
        self::assertContains('name', $paths);
        self::assertContains('countryCode', $paths);
        self::assertSame([], $this->as($chidi, 'GET', '/api/orgs')['organisations'] ?? null);
    }

    #[Test]
    public function aMemberLeavesAndIsListedAsLeft(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->as($chidi, 'POST', $this->path('/leave'));
        self::assertSame(204, $this->statusCode());

        $this->as($chidi, 'GET', $this->path('/permissions'));
        self::assertSame(404, $this->statusCode());
        self::assertSame([], $this->as($chidi, 'GET', '/api/orgs')['organisations'] ?? null, 'in none, and still let in');
        $account = $this->as($chidi, 'GET', '/api/auth/me');
        self::assertTrue($account['complete'] ?? null, 'not sent back to the details screen');
        self::assertFalse($account['needsOrganisation'] ?? null);
        self::assertSame(1, $this->audited(MemberActions::LEFT));
    }

    #[Test]
    public function theLastOwnerCannotLeaveBeDemotedOrBeRemoved(): void
    {
        $kemi = $this->member('kemi@ire.events', 'Kemi Lawal', SeededRole::Owner);
        $this->as($kemi, 'POST', $this->path('/leave'));
        self::assertSame(204, $this->statusCode());

        $left = $this->as($this->owner, 'POST', $this->path('/leave'));
        self::assertSame(409, $this->statusCode(), Json\encode($left));
        self::assertSame(ErrorCode::LastOwner->type(), $left['type'] ?? null);

        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Owner);
        $this->as($bisi, 'DELETE', $this->path('/members/' . $this->membershipOf($this->owner)));
        self::assertSame(204, $this->statusCode());

        $this->as($this->owner, 'GET', $this->path('/permissions'));
        self::assertSame(404, $this->statusCode());

        $demoted = $this->as($bisi, 'PATCH', $this->path('/members/' . $this->membershipOf($bisi)), ['roleId' => $this->roleId(SeededRole::ReadOnly)]);
        self::assertSame(ErrorCode::Conflict->type(), $demoted['type'] ?? null);
        $this->as($bisi, 'POST', $this->path('/leave'));
        self::assertSame(409, $this->statusCode());
        self::assertSame(SeededRole::Owner, $this->roleOf($bisi));
    }

    #[Test]
    public function withASecondOwnerEitherCanBeDemotedAndTheOtherStaysOwner(): void
    {
        $kemi = $this->member('kemi@ire.events', 'Kemi Lawal', SeededRole::Owner);

        $this->as($kemi, 'PATCH', $this->path('/members/' . $this->membershipOf($this->owner)), ['roleId' => $this->roleId(SeededRole::Coordinator)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame([SeededRole::Coordinator, SeededRole::Owner], [$this->roleOf($this->owner), $this->roleOf($kemi)]);

        $body = $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($kemi)), ['roleId' => $this->roleId(SeededRole::Coordinator)]);
        self::assertSame(403, $this->statusCode(), Json\encode($body));
    }

    #[Test]
    public function aTransferNeedsTheOwnerToProveItIsThemFirst(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);

        $body = $this->as($this->owner, 'POST', $this->path('/ownership'), ['membershipId' => $this->membershipOf($bisi)]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::ProofRequired->type(), $body['type'] ?? null);
        self::assertSame([SeededRole::Owner, SeededRole::Administrator], [$this->roleOf($this->owner), $this->roleOf($bisi)]);
    }

    #[Test]
    public function aTransferLeavesThePreviousOwnerAnAdministratorAndTellsThemBoth(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->transfer($this->membershipOf($chidi));
        self::assertSame(204, $this->statusCode());

        self::assertSame([SeededRole::Administrator, SeededRole::Owner], [$this->roleOf($this->owner), $this->roleOf($chidi)]);
        $mails = Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && 'Ìrè Events has a new owner' === $message->getSubject());
        self::assertSame(
            ['chidi@ire.events', 'folake@ire.events'],
            Vec\sort(Vec\map($mails, static fn (object $mail): string => Type\instance_of(Email::class)->coerce($mail)->getTo()[0]->getAddress())),
        );
        self::assertSame(1, $this->audited(OwnershipTransfer::TRANSFERRED));
    }

    #[Test]
    public function aTransferIsWithheldFromAnOwnerWithoutTheTwoFactorTheOrganisationRequires(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->organisation->setAdministratorsNeedTwoFactor(true);
        self::em()->flush();

        $body = $this->transfer($this->membershipOf($bisi));

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OrganisationTwoFactorRequired->type(), $body['type'] ?? null);
        self::assertSame([SeededRole::Owner, SeededRole::Administrator], [$this->roleOf($this->owner), $this->roleOf($bisi)]);
    }

    #[Test]
    public function aNewOwnerMustBeChosenFromTheOtherActiveMembers(): void
    {
        $body = $this->transfer($this->membershipOf($this->owner));

        self::assertSame(422, $this->statusCode(), Json\encode($body));
        self::assertSame(SeededRole::Owner, $this->roleOf($this->owner));
    }

    #[Test]
    public function onlyAnOwnerTransfers(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $proof = $this->as($bisi, 'POST', '/api/auth/proof', ['password' => self::PASSWORD]);

        $body = $this->as($bisi, 'POST', $this->path('/ownership'), ['membershipId' => $this->membershipOf($chidi), 'proof' => $proof['proof'] ?? null]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OwnerRequired->type(), $body['type'] ?? null);
        self::assertSame('Only an owner can transfer ownership.', $body['detail'] ?? null);
    }

    #[Test]
    public function aSuspendedMembersSessionIsRefusedUntilTheyAreRestoredWithTheirRole(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator, withOwn: true);
        $token = $this->token($chidi);
        $this->bearing($token, 'GET', $this->path('/permissions'));
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(['Access suspended: Ìrè Events'], $this->subjectsTo('chidi@ire.events'));

        $refused = $this->bearing($token, 'GET', $this->path('/permissions'));
        self::assertSame(404, $this->statusCode(), Json\encode($refused));
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->bearing($token, 'GET', '/api/orgs')['organisations'] ?? null), 'their own organisation untouched');
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus());

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(['Access restored: Ìrè Events'], $this->subjectsTo('chidi@ire.events'));
        self::assertStringNotContainsString('Folake', $this->bodyTo('chidi@ire.events'), 'it does not say who restored them');
        self::assertStringContainsString('as Coordinator, the role you had', $this->bodyTo('chidi@ire.events'));

        $this->bearing($token, 'GET', $this->path('/permissions'));
        self::assertSame(200, $this->statusCode());
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
        self::assertSame([1, 1], [$this->audited(MemberSuspension::SUSPENDED), $this->audited(MemberSuspension::RESTORED)]);

        $list = $this->as($this->owner, 'GET', $this->path('/members'));
        $rows = Vec\filter(Type\vec(Type\shape(['user' => Type\shape(['name' => Type\string()], true), 'history' => Type\vec(Type\shape(['from' => Type\nullable(Type\string()), 'to' => Type\string(), 'channel' => Type\string()], true))], true))->coerce($list['members']), static fn (array $one): bool => 'Chidi Okoro' === $one['user']['name']);
        self::assertSame(
            [['active', 'suspended', 'settings'], ['suspended', 'active', 'settings']],
            Vec\map($rows[0]['history'] ?? [], static fn (array $step): array => [$step['from'], $step['to'], $step['channel']]),
        );
    }

    #[Test]
    public function nobodySuspendsThemselvesOrAnOwnerOrWithoutManagingMembers(): void
    {
        $kemi = $this->member('kemi@ire.events', 'Kemi Lawal', SeededRole::Owner);
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        foreach ([[$bisi, $bisi], [$this->owner, $kemi], [$bisi, $this->owner], [$chidi, $bisi]] as [$by, $whom]) {
            $body = $this->as($by, 'POST', $this->path('/members/' . $this->membershipOf($whom) . '/suspend'));
            self::assertSame(403, $this->statusCode(), Json\encode($body));
        }

        self::assertSame(
            [MembershipStatus::Active, MembershipStatus::Active, MembershipStatus::Active],
            [$this->membership($this->owner)->getStatus(), $this->membership($kemi)->getStatus(), $this->membership($bisi)->getStatus()],
        );
        self::assertSame(0, $this->audited(MemberSuspension::SUSPENDED));
    }

    #[Test]
    public function onlyAnActiveMemberIsSuspendedAndOnlyASuspendedOneRestored(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $restored = $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(409, $this->statusCode(), Json\encode($restored));
        self::assertSame(ErrorCode::Conflict->type(), $restored['type'] ?? null);

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));
        $again = $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));
        self::assertSame(409, $this->statusCode(), Json\encode($again));
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus());
        self::assertSame(1, $this->audited(MemberSuspension::SUSPENDED));
    }

    #[Test]
    public function restoringWaitsForAFreeTeamSeatAndSuspendingFreesOne(): void
    {
        $this->seats('2');
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));

        $refused = $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(409, $this->statusCode(), Json\encode($refused));
        self::assertSame(ErrorCode::TeamSeatsInUse->type(), $refused['type'] ?? null);
        self::assertSame("All 2 team seats on this organisation's plan are in use, so nothing has changed.", $refused['detail'] ?? null);
        self::assertSame(2, $refused['limit'] ?? null);
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus());

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($bisi) . '/suspend'));
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(MembershipStatus::Active, $this->membership($chidi)->getStatus());
    }

    #[Test]
    public function aMemberSuspendedByHandKeepsTheirRoleUntilRestored(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));

        $refused = $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId(SeededRole::Administrator)]);

        self::assertSame(409, $this->statusCode(), Json\encode($refused));
        self::assertSame(ErrorCode::Conflict->type(), $refused['type'] ?? null);
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus());
        self::assertSame(0, $this->audited(MemberActions::ROLE_CHANGED));

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(MembershipStatus::Active, $this->membership($chidi)->getStatus());
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
    }

    #[Test]
    public function aMemberSuspendedThroughTheDomainKeepsTheirRoleUntilRestored(): void
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new OrganisationDomain($organisation, 'ire.events'));
        $chidi = $this->account('chidi@ire.events', 'Chidi Okoro');
        self::service(MembershipMachine::class)->join($organisation, $chidi, $this->role(SeededRole::Coordinator), MembershipStatus::Active, MembershipChannel::Domain, $chidi);
        self::em()->flush();
        $this->as($this->owner, 'DELETE', $this->path('/domains/ire.events'));
        self::assertSame(200, $this->statusCode());

        $refused = $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId(SeededRole::Administrator)]);

        self::assertSame(409, $this->statusCode(), Json\encode($refused));
        self::assertSame(ErrorCode::Conflict->type(), $refused['type'] ?? null);
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
        self::assertSame(Suspension::DomainClosed, $this->membership($chidi)->getSuspension());
        self::assertSame(0, $this->audited(MemberActions::ROLE_CHANGED));

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(MembershipStatus::Active, $this->membership($chidi)->getStatus());
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
    }

    #[Test]
    public function aSuspendedMembersRoleChangeIsStillRefusedFirstWithoutTheGrant(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));

        $this->as($bisi, 'PATCH', $this->path('/members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId(SeededRole::ReadOnly)]);
        self::assertSame(403, $this->statusCode());

        $theirs = $this->account('kemi@ire.events', 'Kemi Lawal', withOwn: true);
        $elsewhere = self::em()->getRepository(Membership::class)->findOneBy(['user' => $theirs->getId()]) ?? self::fail('no membership');
        $this->as($this->owner, 'PATCH', $this->path('/members/' . $elsewhere->getId()->toRfc4122()), ['roleId' => $this->roleId(SeededRole::ReadOnly)]);
        self::assertSame(404, $this->statusCode());
        self::assertSame(SeededRole::Coordinator, $this->roleOf($chidi));
    }

    #[Test]
    public function aSingleSeatIsNamedAsTheOnlyOne(): void
    {
        $this->seats('1');
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));

        $refused = $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/restore'));

        self::assertSame("The only team seat on this organisation's plan is in use, so nothing has changed.", $refused['detail'] ?? null);
    }

    #[Test]
    public function aSuspendedMemberCannotLeave(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));

        $this->as($chidi, 'POST', $this->path('/leave'));

        self::assertSame(404, $this->statusCode());
        self::assertSame(MembershipStatus::Suspended, $this->membership($chidi)->getStatus());
    }

    #[Test]
    public function aSuspensionByHandRunsNoRemovalClockAndIsNotListedAsPaused(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator, withOwn: true);
        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($chidi) . '/suspend'));

        self::assertSame(Suspension::Manual, $this->membership($chidi)->getSuspension());
        self::assertNull($this->membership($chidi)->getRemovesAt());
        self::assertSame([], $this->as($chidi, 'GET', '/api/orgs')['paused'] ?? null);
    }

    #[Test]
    public function anotherOrganisationsMemberIsNotFound(): void
    {
        $chidi = $this->account('chidi@ire.events', 'Chidi Okoro', withOwn: true);
        $theirs = self::em()->getRepository(Membership::class)->findOneBy(['user' => $chidi->getId()]) ?? self::fail('no membership');

        foreach (['/suspend', '/restore'] as $action) {
            $this->as($this->owner, 'POST', $this->path('/members/' . $theirs->getId()->toRfc4122() . $action));
            self::assertSame(404, $this->statusCode());
        }
    }

    /** @return array<string, mixed> */
    private function transfer(string $membershipId): array
    {
        $proof = $this->as($this->owner, 'POST', '/api/auth/proof', ['password' => self::PASSWORD]);

        return $this->as($this->owner, 'POST', $this->path('/ownership'), ['membershipId' => $membershipId, 'proof' => $proof['proof'] ?? null]);
    }

    private function seats(string $limit): void
    {
        self::getContainer()->set(TeamSeats::class, new TeamSeats(self::service(MembershipRepository::class), self::service(TranslatorInterface::class), self::service(EntityManagerInterface::class), $limit));
    }

    private function bodyTo(string $address): string
    {
        $mail = Iter\first(Vec\filter(self::getMailerMessages(), static fn (object $message): bool => $message instanceof Email && $address === $message->getTo()[0]->getAddress()));

        return (string) Type\instance_of(Email::class)->coerce($mail)->getTextBody();
    }

    /** @return list<string> */
    private function subjectsTo(string $address): array
    {
        return Vec\filter_nulls(Vec\map(
            self::getMailerMessages(),
            static fn (object $message): ?string => $message instanceof Email && $address === $message->getTo()[0]->getAddress() ? $message->getSubject() : null,
        ));
    }

    private function audited(string $action): int
    {
        return self::em()->getRepository(AuditEntry::class)->count(['action' => $action]);
    }

    private function account(string $address, string $name, bool $withOwn = false): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: $withOwn);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded, bool $withOwn = false): User
    {
        $user = $this->account($address, $name, $withOwn);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, $this->role($seeded), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    /** Billing at Change, which only Owner holds in a new organisation, given by the owner as Settings > Roles and the member's page would. */
    private function financeFor(User $member): void
    {
        $created = $this->as($this->owner, 'POST', $this->path('/roles'), ['name' => 'Finance', 'permissions' => ['billing.read', 'billing.manage']]);
        self::assertSame(201, $this->statusCode(), Json\encode($created));
        $finance = Type\shape(['id' => Type\string()], true)->coerce($created);

        $this->as($this->owner, 'PATCH', $this->path('/members/' . $this->membershipOf($member)), ['roleId' => $finance['id']]);
        self::assertSame(204, $this->statusCode());
    }

    private function role(SeededRole $seeded): Role
    {
        return self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation->getId(), 'seededAs' => $seeded]) ?? self::fail('no role');
    }

    private function roleId(SeededRole $seeded): string
    {
        return $this->role($seeded)->getId()->toRfc4122();
    }

    private function membership(User $user): Membership
    {
        self::em()->clear();

        return self::em()->getRepository(Membership::class)->findOneBy(['organisation' => $this->organisation->getId(), 'user' => $user->getId()]) ?? self::fail('no membership');
    }

    private function membershipOf(User $user): string
    {
        return $this->membership($user)->getId()->toRfc4122();
    }

    private function roleOf(User $user): ?SeededRole
    {
        return $this->membership($user)->getRole()->getSeededAs();
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . $rest;
    }

    private function token(User $user): string
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');

        return self::service(JWTTokenManagerInterface::class)->create($who);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        return $this->bearing($this->token($user), $method, $path, $body);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function bearing(#[SensitiveParameter] string $token, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
