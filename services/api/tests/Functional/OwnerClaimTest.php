<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\DomainJoining\DomainSuspender;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\OwnerClaims\OwnerClaimHandler;
use App\Domain\Organisation\OwnerClaims\ScriptedTxtRecordLookup;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailAddress;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\OwnerClaim;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\OwnerClaimOutcome;
use App\Enum\SeededRole;
use App\Http\AfterResponse;
use App\Repository\MembershipRepository;
use App\Repository\OwnerClaimRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateInterval;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

final class OwnerClaimTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string RECORD = '_soirely-verify.ire.events';

    protected function setUp(): void
    {
        parent::setUp();
        ScriptedTxtRecordLookup::forgetAll();
    }

    #[Test]
    public function onlyAnActiveAdministratorSeesTheBannerAndOnlyWhileNoOwnerIsActive(): void
    {
        [$owner, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $reader = $this->member('kemi@ire.events');
        $this->join($organisation, $reader, SeededRole::ReadOnly);

        $this->signIn($administrator);
        self::assertSame('no_owner', $this->banner($organisation)['state'] ?? null);
        self::assertSame('ire.events', $this->banner($organisation)['domain'] ?? null);

        $this->signIn($reader);
        self::assertNull($this->send('GET', $this->claimPath($organisation))['ownerClaim'], 'a member who is not an Administrator');

        $this->makePrimary($owner, 'folake@ire.events');
        $this->signIn($administrator);
        $this->send('POST', $this->restorePath($organisation, $owner));
        self::assertResponseStatusCodeSame(204);
        self::assertNull($this->send('GET', $this->claimPath($organisation))['ownerClaim'], 'an active Owner again');
    }

    #[Test]
    public function anAdministratorWhoseAddressIsElsewhereIsRefused(): void
    {
        [, $organisation] = $this->onlyOwnerSuspended();
        $outsider = $this->member('ade@okafor.family');
        $this->join($organisation, $outsider, SeededRole::Administrator);
        $this->signIn($outsider);

        $body = $this->send('POST', $this->claimPath($organisation));

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::OwnerClaimAddress->type(), $body['type'] ?? null);
        self::assertSame('To become the owner, your main address must be at ire.events.', $body['detail'] ?? null);
        self::assertNull(self::service(OwnerClaimRepository::class)->findOpenIn($organisation));
        self::assertSame('ire.events', $this->banner($organisation)['domain'] ?? null, 'the banner names the organisation\'s domain, as the refusal does');
    }

    #[Test]
    public function aDomainAnotherOrganisationProvedIsRefused(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $prover = self::service(OrganisationFounder::class)->found($this->member('bisi.group@ire.events'), 'Ìrè Group', 'NG', 'Africa/Lagos');
        $this->list($prover, 'ire.events')->setProvedAt(new DateTimeImmutable());
        $this->signIn($administrator);

        $body = $this->send('POST', $this->claimPath($organisation));

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::OwnerClaimManaged->type(), $body['type'] ?? null);
        self::assertSame('ire.events is managed by another organisation. Contact Soirely support.', $body['detail'] ?? null);
    }

    #[Test]
    public function startingShowsTheClaimantAFreshRecordAndLapsesInSevenDays(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $this->signIn($administrator);

        $banner = $this->bannerOf($this->send('POST', $this->claimPath($organisation)));

        self::assertResponseStatusCodeSame(201);
        self::assertSame('open', $banner['state']);
        // The keys the clients read (packages/api-client asOwnerClaimBanner), so a rename here fails here.
        self::assertSame(['state', 'domain', 'claim', 'stopped', 'lapsed'], Vec\keys($banner));
        self::assertSame(
            ['id', 'claimant', 'mine', 'domain', 'record', 'startedAt', 'lapsesAt', 'foundAt', 'passesAt'],
            Vec\keys(Type\dict(Type\string(), Type\mixed())->coerce($banner['claim'])),
        );
        $claim = Type\shape([
            'mine' => Type\bool(),
            'record' => Type\shape(['type' => Type\string(), 'name' => Type\string(), 'value' => Type\string()]),
            'startedAt' => Type\shape(['at' => Type\string()], true),
            'lapsesAt' => Type\shape(['at' => Type\string()], true),
            'passesAt' => Type\null(),
        ], true)->coerce($banner['claim']);
        self::assertTrue($claim['mine']);
        self::assertSame(['type' => 'TXT', 'name' => self::RECORD], ['type' => $claim['record']['type'], 'name' => $claim['record']['name']]);
        self::assertMatchesRegularExpression('/^soirely-claim=[a-z0-9]{32}$/', $claim['record']['value']);
        self::assertEquals(new DateTimeImmutable($claim['startedAt']['at'])->add(new DateInterval('PT168H')), new DateTimeImmutable($claim['lapsesAt']['at']));
        self::assertNotNull($this->audited(OwnerClaimHandler::STARTED, $this->openClaim($organisation)));
    }

    #[Test]
    public function aRecordNeverFoundLapsesAtSevenDaysAndTheNextClaimHasANewValue(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $first = $this->started($organisation, $administrator);
        $this->moveClaim($first, 'started_at', '-168 hours -1 minute');
        $this->moveClaim($first, 'lapses_at', '-1 minute');

        self::assertSame(1, self::service(OwnerClaimHandler::class)->settleDue());

        $lapsed = $this->claim($first);
        self::assertSame(OwnerClaimOutcome::Unfound, $lapsed->getOutcome());
        self::assertEquals($lapsed->getLapsesAt(), $lapsed->getEndedAt(), 'lapsed as of its own instant');
        self::assertNotNull($this->audited(OwnerClaimHandler::LAPSED, $lapsed));
        $this->signIn($administrator);
        self::assertSame('unfound', Type\shape(['outcome' => Type\string()], true)->coerce($this->banner($organisation)['lapsed'])['outcome']);

        $second = $this->started($organisation, $administrator);
        self::assertNotSame($first->getRecordValue(), $second->getRecordValue());
    }

    #[Test]
    public function aSecondClaimIsRefusedWhileOneIsOpenAndTheOtherAdministratorSeesWhoIsClaiming(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $other = $this->member('kemi@ire.events', 'Kemi');
        $this->join($organisation, $other, SeededRole::Administrator);
        $this->started($organisation, $administrator);
        $this->signIn($other);

        $body = $this->send('POST', $this->claimPath($organisation));

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::OwnerClaimOpen->type(), $body['type'] ?? null);
        $banner = $this->banner($organisation);
        $claim = Type\shape(['mine' => Type\bool(), 'record' => Type\mixed(), 'claimant' => Type\shape(['name' => Type\string()], true)], true)->coerce($banner['claim']);
        self::assertSame('open', $banner['state']);
        self::assertFalse($claim['mine']);
        self::assertNull($claim['record'], 'only the claimant is shown the record');
        self::assertSame('Bisi', $claim['claimant']['name']);
    }

    #[Test]
    public function theOtherAdministratorSeesTheLapseUntilTheRecordIsFoundAndThePassingInstantAfter(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $other = $this->member('kemi@ire.events', 'Kemi');
        $this->join($organisation, $other, SeededRole::Administrator);
        $claim = $this->started($organisation, $administrator);
        $instants = Type\shape(['lapsesAt' => Type\shape(['at' => Type\string()], true), 'passesAt' => Type\nullable(Type\shape(['at' => Type\string()], true))], true);
        $this->signIn($other);

        $before = $this->banner($organisation);
        self::assertSame('open', $before['state']);
        $waiting = $instants->coerce($before['claim']);
        self::assertSame($claim->getLapsesAt()->format(\DATE_ATOM), $waiting['lapsesAt']['at']);
        self::assertNull($waiting['passesAt']);

        $this->signIn($administrator);
        ScriptedTxtRecordLookup::publish(self::RECORD, $claim->getRecordValue());
        $this->send('POST', $this->claimPath($organisation) . '/check');
        $found = $this->claim($claim);
        $this->signIn($other);

        $after = $this->banner($organisation);
        self::assertSame('found', $after['state']);
        self::assertSame($found->getPassesAt()?->format(\DATE_ATOM), $instants->coerce($after['claim'])['passesAt']['at'] ?? null);
    }

    #[Test]
    public function checkRecordSaysNotFoundThenStartsTheSeventyTwoHoursWhenItIs(): void
    {
        [$owner, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->started($organisation, $administrator);

        $body = $this->send('POST', $this->claimPath($organisation) . '/check');
        self::assertResponseStatusCodeSame(200);
        self::assertFalse($body['found'] ?? null);

        ScriptedTxtRecordLookup::publish(self::RECORD, $claim->getRecordValue());
        $body = $this->send('POST', $this->claimPath($organisation) . '/check');

        self::assertTrue($body['found'] ?? null);
        self::assertSame('found', $this->bannerOf($body)['state']);
        $found = $this->claim($claim);
        $foundAt = $found->getFoundAt() ?? self::fail('not found');
        self::assertEquals($foundAt->add(new DateInterval('PT72H')), $found->getPassesAt());
        self::assertNotNull($this->audited(OwnerClaimHandler::FOUND, $found));
        $started = $this->mailsTitled('will become the owner of Ìrè Events on');
        self::assertEqualsCanonicalizing(['bisi@ire.events', 'folake@okafor.family'], Vec\map($started, self::to(...)));
        $toOwner = Iter\search($started, static fn (Email $mail): bool => 'folake@okafor.family' === self::to($mail)) ?? self::fail('the suspended owner was not told');
        self::assertStringContainsString("You're getting this because you're an owner of Ìrè Events. We sent it to your account's main email address.", (string) $toOwner->getTextBody());
        self::assertStringContainsString('Claimant: Bisi · bisi@ire.events', (string) $toOwner->getTextBody());
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($owner, $organisation)->getStatus());
    }

    #[Test]
    public function theHourlyCheckFindsARecordOnceAnHourHasPassed(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->started($organisation, $administrator);
        ScriptedTxtRecordLookup::publish(self::RECORD, $claim->getRecordValue());

        self::assertSame(0, self::service(OwnerClaimHandler::class)->settleDue(), 'checked when it started');

        $this->moveClaim($claim, 'checked_at', '-61 minutes');
        self::assertSame(1, self::service(OwnerClaimHandler::class)->settleDue());
        self::assertNotNull($this->claim($claim)->getFoundAt());
    }

    #[Test]
    public function ownershipPassesAtFoundPlusSeventyTwoHoursAndTheSuspendedOwnerCanThenBeRemoved(): void
    {
        [$owner, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->found($organisation, $administrator, '-72 hours -5 minutes');
        $passesAt = $this->claim($claim)->getPassesAt() ?? self::fail('no passing instant');

        self::assertSame(1, self::service(OwnerClaimHandler::class)->settleDue());

        $passed = $this->claim($claim);
        self::assertSame(OwnerClaimOutcome::Passed, $passed->getOutcome());
        self::assertEquals($passesAt, $passed->getEndedAt());
        self::assertTrue($this->membershipOf($administrator, $organisation)->getRole()->isOwner());
        $audit = $this->audited(OwnerClaimHandler::PASSED, $passed)->getChanges();
        self::assertSame([null, 'ire.events'], $audit['domain'] ?? null);
        self::assertSame([null, $claim->getRecordValue()], $audit['record'] ?? null);
        self::assertCount(2, $this->mailsTitled('is now the owner of Ìrè Events'));
        self::assertEquals(
            $passesAt->add(new DateInterval(Membership::UNANSWERED_FOR)),
            $this->membershipOf($owner, $organisation)->getRemovesAt(),
            'the 30 days run from the instant ownership passed',
        );

        $this->signIn($administrator);
        self::assertNull($this->send('GET', $this->claimPath($organisation))['ownerClaim'], 'no banner after passing');
        $this->send('DELETE', Str\format('/api/orgs/%s/members/%s', $organisation->getId()->toRfc4122(), $this->membershipOf($owner, $organisation)->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(204);
    }

    #[Test]
    public function aRecordGoneAtThePassingInstantLapsesTheClaim(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->found($organisation, $administrator, '-72 hours -1 minute');
        ScriptedTxtRecordLookup::unpublish(self::RECORD);

        self::service(OwnerClaimHandler::class)->settleDue();

        self::assertSame(OwnerClaimOutcome::RecordRemoved, $this->claim($claim)->getOutcome());
        self::assertSame(SeededRole::Administrator, $this->membershipOf($administrator, $organisation)->getRole()->getSeededAs());
        $this->signIn($administrator);
        $banner = $this->banner($organisation);
        self::assertSame('no_owner', $banner['state']);
        self::assertSame('record_removed', Type\shape(['outcome' => Type\string()], true)->coerce($banner['lapsed'])['outcome']);
    }

    #[Test]
    public function theClaimantIsNoLongerAnActiveAdministratorAtThePassingInstantAndTheClaimLapses(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->found($organisation, $administrator, '-72 hours -1 minute');
        $readOnly = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::ReadOnly]),
        );
        self::service(RoleAssignment::class)->assign($this->membershipOf($administrator, $organisation), $readOnly);
        self::service(EntityManagerInterface::class)->flush();

        self::assertSame(1, self::service(OwnerClaimHandler::class)->settleDue());

        $lapsed = $this->claim($claim);
        self::assertSame(OwnerClaimOutcome::ClaimantGone, $lapsed->getOutcome());
        self::assertEquals($lapsed->getPassesAt(), $lapsed->getEndedAt());
        self::assertFalse($this->membershipOf($administrator, $organisation)->getRole()->isOwner());
        self::assertCount(0, $this->mailsTitled('is now the owner of Ìrè Events'));
    }

    #[Test]
    public function theClaimantCannotStopTheirOwnClaim(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->found($organisation, $administrator, '-1 hour');

        $body = $this->send('POST', $this->claimPath($organisation) . '/stop');

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::OwnerClaimOwn->type(), $body['type'] ?? null);
        self::assertSame('You cannot stop your own claim.', $body['detail'] ?? null);
        self::assertTrue($this->claim($claim)->isOpen());
        self::assertNull(self::service(OwnerClaimRepository::class)->findStopIn($organisation), 'the way stays open');
    }

    #[Test]
    public function anAdministratorStopsTheClaimAndTheWayIsClosed(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $other = $this->member('kemi@ire.events', 'Kemi');
        $this->join($organisation, $other, SeededRole::Administrator);
        $claim = $this->found($organisation, $administrator, '-1 hour');
        $this->signIn($other);

        $banner = $this->bannerOf($this->send('POST', $this->claimPath($organisation) . '/stop'));

        self::assertResponseStatusCodeSame(200);
        self::assertSame('closed', $banner['state']);
        $stopped = $this->claim($claim);
        self::assertSame(OwnerClaimOutcome::Stopped, $stopped->getOutcome());
        self::assertNotNull($this->audited(OwnerClaimHandler::STOPPED, $stopped));
        self::assertCount(3, $this->mailsTitled("Kemi stopped Bisi's claim to own Ìrè Events"), 'both Administrators and the suspended owner were told before');

        $this->signIn($administrator);
        $body = $this->send('POST', $this->claimPath($organisation));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::OwnerClaimClosed->type(), $body['type'] ?? null);
        self::assertSame('Ownership has to be restored by Soirely support.', $body['detail'] ?? null);
    }

    #[Test]
    public function theSuspendedOwnerSeesTheClaimOnThePausedScreenAndStopsIt(): void
    {
        [$owner, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->found($organisation, $administrator, '-1 hour');
        $this->signIn($owner);

        $paused = Type\vec(Type\shape(['id' => Type\string(), 'ownerClaim' => Type\mixed()], true))->coerce($this->send('GET', '/api/orgs')['paused']);
        $shown = Type\shape(['claimant' => Type\shape(['name' => Type\string()], true)], true)->coerce($paused[0]['ownerClaim']);
        self::assertSame('Bisi', $shown['claimant']['name']);

        $this->send('POST', $this->claimPath($organisation) . '/stop');

        self::assertResponseStatusCodeSame(200);
        self::assertSame(OwnerClaimOutcome::Stopped, $this->claim($claim)->getOutcome());
        self::assertTrue(true === $this->claim($claim)->getStoppedBy()?->getId()->equals($owner->getId()));
    }

    #[Test]
    public function aMemberWhoIsNeitherMayNotStopIt(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $reader = $this->member('kemi@ire.events');
        $this->join($organisation, $reader, SeededRole::ReadOnly);
        $claim = $this->started($organisation, $administrator);
        $this->signIn($reader);

        $this->send('POST', $this->claimPath($organisation) . '/stop');

        self::assertResponseStatusCodeSame(403);
        self::assertTrue($this->claim($claim)->isOpen());

        $this->signIn($this->member('ade@okafor.family'));
        $body = $this->send('POST', $this->claimPath($organisation) . '/stop');

        self::assertResponseStatusCodeSame(404, 'an outsider is answered as if the organisation did not exist');
        self::assertSame(ErrorCode::NotFound->type(), $body['type'] ?? null);
        self::assertTrue($this->claim($claim)->isOpen());
    }

    #[Test]
    public function stoppingAClaimThatHasEndedSaysSo(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $this->signIn($administrator);

        $body = $this->send('POST', $this->claimPath($organisation) . '/stop');

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::OwnerClaimEnded->type(), $body['type'] ?? null);
        self::assertSame('This claim has already ended, so there was nothing to stop.', $body['detail'] ?? null);
    }

    #[Test]
    public function restoringTheSuspendedOwnerEndsTheClaim(): void
    {
        [$owner, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $claim = $this->found($organisation, $administrator, '-1 hour');
        $this->makePrimary($owner, 'folake@ire.events');
        $this->signIn($administrator);

        $this->send('POST', $this->restorePath($organisation, $owner));

        self::assertResponseStatusCodeSame(204);
        self::assertSame(OwnerClaimOutcome::OwnerBack, $this->claim($claim)->getOutcome());
        self::assertNull(self::service(OwnerClaimRepository::class)->findStopIn($organisation), 'a Restore does not close the way');
    }

    #[Test]
    public function thePassingInstantIsOneInstantWrittenInEachReadersZone(): void
    {
        [, $organisation, $administrator] = $this->onlyOwnerSuspended();
        $other = $this->member('kemi@ire.events', 'Kemi');
        $this->join($organisation, $other, SeededRole::Administrator);
        $administrator->setTimezone('Africa/Lagos');
        $other->setTimezone('Europe/London');
        $this->found($organisation, $administrator, '-1 hour');

        $lagos = $this->passesAt($organisation, $administrator);
        $london = $this->passesAt($organisation, $other);

        self::assertSame($lagos['at'], $london['at']);
        self::assertStringEndsWith(' WAT', $lagos['written']);
        self::assertMatchesRegularExpression('/ (GMT|BST)$/', $london['written']);
    }

    /** @return array{at: string, written: string} */
    private function passesAt(Organisation $organisation, User $reader): array
    {
        $this->signIn($reader);

        return Type\shape(['passesAt' => Type\shape(['at' => Type\string(), 'written' => Type\string()])], true)->coerce($this->banner($organisation)['claim'])['passesAt'];
    }

    private function started(Organisation $organisation, User $administrator): OwnerClaim
    {
        $this->signIn($administrator);
        $this->send('POST', $this->claimPath($organisation));
        self::assertResponseStatusCodeSame(201);

        return $this->openClaim($organisation);
    }

    private function found(Organisation $organisation, User $administrator, string $ago): OwnerClaim
    {
        $claim = $this->started($organisation, $administrator);
        ScriptedTxtRecordLookup::publish(self::RECORD, $claim->getRecordValue());
        $this->send('POST', $this->claimPath($organisation) . '/check');
        self::assertResponseStatusCodeSame(200);
        $at = new DateTimeImmutable($ago);
        $this->moveClaim($claim, 'found_at', $ago);
        $this->moveClaim($claim, 'passes_at', $at->add(new DateInterval('PT72H'))->format('Y-m-d H:i:s'));

        return $this->claim($claim);
    }

    private function moveClaim(OwnerClaim $claim, string $column, string $to): void
    {
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(
            Str\format('UPDATE owner_claims SET %s = ? WHERE id = ?', $column),
            [new DateTimeImmutable($to)->format('Y-m-d H:i:s'), $claim->getId()->toRfc4122()],
        );
    }

    private function claim(OwnerClaim $claim): OwnerClaim
    {
        $fresh = self::service(OwnerClaimRepository::class)->find($claim->getId()) ?? self::fail('no such claim');
        self::service(EntityManagerInterface::class)->refresh($fresh);

        return $fresh;
    }

    private function openClaim(Organisation $organisation): OwnerClaim
    {
        return self::service(OwnerClaimRepository::class)->findOpenIn($organisation) ?? self::fail('no open claim');
    }

    /** @return array<string, mixed> */
    private function banner(Organisation $organisation): array
    {
        return $this->bannerOf($this->send('GET', $this->claimPath($organisation)));
    }

    /** @return array<string, mixed> */
    private function bannerOf(mixed $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Type\shape(['ownerClaim' => Type\mixed()], true)->coerce($body)['ownerClaim']);
    }

    /** @return array{User, Organisation, User} the founder, the only Owner, suspended; and the Administrator left behind */
    private function onlyOwnerSuspended(): array
    {
        $owner = $this->member('folake@ire.events', 'Folake');
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();
        $this->list($organisation, 'ire.events');
        $administrator = $this->member('bisi@ire.events', 'Bisi');
        $this->join($organisation, $administrator, SeededRole::Administrator);
        $this->membershipOf($owner, $organisation)->setDomain('ire.events');
        $this->verifiedAlternative($owner, 'folake@okafor.family');
        $this->makePrimary($owner, 'folake@okafor.family');
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($owner, $organisation)->getStatus());

        return [$owner, $organisation, $administrator];
    }

    private function member(string $address, string $name = 'Member'): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function join(Organisation $organisation, User $user, SeededRole $as): void
    {
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]),
        );
        self::service(MembershipMachine::class)->join($organisation, $user, $role, MembershipStatus::Active, MembershipChannel::Invitation, $user);
        self::service(EntityManagerInterface::class)->flush();
    }

    private function list(Organisation $organisation, string $domain): OrganisationDomain
    {
        $listing = new OrganisationDomain($organisation, $domain);
        self::service(EntityManagerInterface::class)->persist($listing);
        self::service(EntityManagerInterface::class)->flush();

        return $listing;
    }

    private function verifiedAlternative(User $user, string $address): EmailAddress
    {
        $added = new EmailAddress($user, Type\non_empty_string()->assert($address));
        $added->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->persist($added);
        self::service(EntityManagerInterface::class)->flush();

        return $added;
    }

    private function makePrimary(User $user, string $address): void
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $user = $entityManager->find(User::class, $user->getId()) ?? self::fail('no such account');

        foreach ($user->getEmailAddresses() as $held) {
            $held->setPrimary(false);
        }

        $entityManager->flush();
        Iter\search($user->getEmailAddresses(), static fn (EmailAddress $held): bool => $held->getAddress() === $address)?->setPrimary(true);
        self::service(DomainSuspender::class)->addressChanged($user);
        $entityManager->flush();
        self::service(AfterResponse::class)->reset();
    }

    private function membershipOf(User $user, Organisation $organisation): Membership
    {
        $membership = self::service(MembershipRepository::class)->findOneBy(['user' => $user, 'organisation' => $organisation]);
        self::assertNotNull($membership);
        self::service(EntityManagerInterface::class)->refresh($membership);

        return $membership;
    }

    private function claimPath(Organisation $organisation): string
    {
        return Str\format('/api/orgs/%s/owner-claim', $organisation->getId()->toRfc4122());
    }

    private function restorePath(Organisation $organisation, User $user): string
    {
        return Str\format('/api/orgs/%s/members/%s/restore', $organisation->getId()->toRfc4122(), $this->membershipOf($user, $organisation)->getId()->toRfc4122());
    }

    private function audited(string $action, OwnerClaim $subject): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => $subject->getId()]),
        );
    }

    /** @return list<Email> */
    private function mailsTitled(string $part): array
    {
        return Vec\map(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), $part),
        ), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message));
    }

    private static function to(Email $mail): string
    {
        return Type\instance_of(Address::class)->coerce($mail->getTo()[0] ?? null)->getAddress();
    }

    private function signIn(User $user): void
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function send(string $method, string $uri, ?array $body = null): array
    {
        $this->client->request($method, $uri, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));
        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($content));
    }
}
