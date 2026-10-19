<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MemberActions;
use App\Domain\Organisation\Members\OwnershipTransfer;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Mime\Email;

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
    public function aMemberLeavesAndIsListedAsLeft(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->as($chidi, 'POST', $this->path('/leave'));
        self::assertSame(204, $this->statusCode());

        $this->as($chidi, 'GET', $this->path('/permissions'));
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::ProfileIncomplete->type(), $this->as($chidi, 'GET', '/api/orgs')['type'] ?? null, 'asked to create one');
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
        self::assertSame(403, $this->statusCode());

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
    }

    /** @return array<string, mixed> */
    private function transfer(string $membershipId): array
    {
        $proof = $this->as($this->owner, 'POST', '/api/auth/proof', ['password' => self::PASSWORD]);

        return $this->as($this->owner, 'POST', $this->path('/ownership'), ['membershipId' => $membershipId, 'proof' => $proof['proof'] ?? null]);
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
        self::em()->persist(new Membership($organisation, $user, $this->role($seeded), MembershipStatus::Active));
        self::em()->flush();

        return $user;
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
