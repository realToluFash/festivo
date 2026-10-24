<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\SignInRules\TwoFactorHolds;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;

/** sc-609: an organisation that requires two-factor of everyone, with 7 days to turn it on. */
final class TwoFactorForEveryoneTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string SECRET = 'JBSWY3DPEHPK3PXP';

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
    public function switchingItOnIsRefusedToSomebodyWithoutTwoFactorAndChangesNothing(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);

        $body = $this->set(['everyoneNeedsTwoFactor' => true]);

        self::assertSame(409, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::TwoFactorOff->type(), $body['type'] ?? null);
        self::assertFalse($this->as($this->owner, 'GET', $this->path())['everyoneNeedsTwoFactor'] ?? null);
        self::assertNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'sign_in_rules.changed']));
        self::assertSame([], $this->mails());
    }

    #[Test]
    public function switchingItOnEmailsEveryMemberWithoutTwoFactorTheDeadline(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $tope = $this->member('tope@ire.events', 'Tope Bello', SeededRole::ReadOnly);
        $this->turnOnTwoFactor($tope);
        $this->turnOnTwoFactor($this->owner);

        $body = $this->set(['everyoneNeedsTwoFactor' => true]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertTrue($body['everyoneNeedsTwoFactor'] ?? null);
        self::assertSame(['Bisi Adeyemi'], Vec\map(
            Type\vec(Type\shape(['name' => Type\string()], true))->coerce($body['withoutTwoFactor'] ?? null),
            static fn (array $member): string => $member['name'],
        ));
        $mails = $this->mails();
        self::assertSame(['bisi@ire.events'], Vec\map($mails, static fn (Email $mail): string => $mail->getTo()[0]->getAddress()));
        self::assertSame('Ìrè Events requires two-factor', $mails[0]->getSubject());
        $deadline = Type\shape(['at' => Type\string(), 'written' => Type\string()], true)->coerce($body['twoFactorDeadline'] ?? null);
        self::assertStringContainsString('Ìrè Events requires two-factor from ' . $deadline['written'], (string) $mails[0]->getTextBody());
        self::assertSame(
            new Clock()->now()->modify('+7 days')->format('Y-m-d H:i'),
            new DateTimeImmutable($deadline['at'])->setTimezone(new Clock()->now()->getTimezone())->format('Y-m-d H:i'),
        );
    }

    #[Test]
    public function aMemberWithoutTwoFactorIsShownTheDeadlineAndOneWithItIsNot(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        $due = Type\shape(['at' => Type\string(), 'written' => Type\string(), 'overdue' => Type\bool()], true)->coerce($this->standingOf($bisi)['twoFactorDue']);

        self::assertFalse($due['overdue']);
        self::assertNull($this->standingOf($this->owner)['twoFactorDue']);
    }

    #[Test]
    public function aMemberWithoutTwoFactorIsHeldBackOnceTheSevenDaysAreOver(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        self::mockTime('+167 hours');
        $this->as($bisi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'within the 7 days everything works');

        self::mockTime('+2 hours');
        $body = $this->as($bisi, 'GET', $this->path());
        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OrganisationTwoFactorOverdue->type(), $body['type'] ?? null);
        self::assertTrue(Type\shape(['overdue' => Type\bool()], true)->coerce($this->standingOf($bisi)['twoFactorDue'])['overdue'], 'the organisation is still listed, to show why');

        $this->turnOnTwoFactor($bisi);
        $this->as($bisi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'turning it on lets them back in on the next request');
    }

    #[Test]
    public function aGoogleSessionIsHeldBackTheSameAsAPasswordOne(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);
        $google = self::service(TokenIssuer::class)->issueFor($this->fresh($bisi), null, IdentityProvider::Google);
        self::em()->flush();

        self::mockTime('+8 days');
        $this->client->request('GET', $this->path(), server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $google->accessToken]);

        self::assertSame(ErrorCode::OrganisationTwoFactorOverdue->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function heldBackInOneOrganisationLeavesTheOthersUntouched(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $other = $this->account('ada@lumen.studio', 'Ada Okoye');
        $lumen = self::service(OrganisationFounder::class)->found($other, 'Studio Lumen', 'GB', 'Europe/London');
        self::em()->flush();
        $this->join($bisi, $lumen, SeededRole::Coordinator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        self::mockTime('+8 days');

        $this->as($bisi, 'GET', $this->path());
        self::assertSame(403, $this->statusCode());
        $this->as($bisi, 'GET', '/api/orgs/' . $lumen->getId()->toRfc4122() . '/sign-in-rules');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function oneSetUpSatisfiesEveryOrganisationThatRequiresIt(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $other = $this->account('ada@lumen.studio', 'Ada Okoye');
        $lumen = self::service(OrganisationFounder::class)->found($other, 'Studio Lumen', 'GB', 'Europe/London');
        self::em()->flush();
        $this->join($bisi, $lumen, SeededRole::Coordinator);
        $this->turnOnTwoFactor($this->owner);
        $this->turnOnTwoFactor($other);
        $this->set(['everyoneNeedsTwoFactor' => true]);
        $this->as($other, 'PATCH', '/api/orgs/' . $lumen->getId()->toRfc4122() . '/sign-in-rules', ['everyoneNeedsTwoFactor' => true]);

        self::mockTime('+8 days');
        $this->turnOnTwoFactor($bisi);

        $this->as($bisi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());
        $this->as($bisi, 'GET', '/api/orgs/' . $lumen->getId()->toRfc4122() . '/sign-in-rules');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function turningTwoFactorOffIsRefusedWhileAnOrganisationRequiresIt(): void
    {
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        $body = $this->as($this->owner, 'POST', '/api/auth/two-factor/disable', ['code' => '000000']);

        self::assertSame(409, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::TwoFactorKeptByRule->type(), $body['type'] ?? null);
        self::assertSame('Ìrè Events', $body['organisation'] ?? null);
        self::assertNotNull(self::em()->getRepository(TwoFactorFactor::class)->findOneBy(['user' => $this->owner->getId()]));
    }

    #[Test]
    public function aNewMemberHasSevenDaysFromJoining(): void
    {
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        self::mockTime('+5 days');
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        self::mockTime('+6 days');
        $this->as($chidi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'eleven days after the switch, six after joining');

        self::mockTime('+2 days');
        $this->as($chidi, 'GET', $this->path());
        self::assertSame(ErrorCode::OrganisationTwoFactorOverdue->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aMemberWhoLeftAndIsInvitedBackHasSevenDaysFromReturning(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $membership = $this->membershipOf($chidi);
        self::service(MembershipMachine::class)->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Settings, $chidi);
        self::em()->flush();
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        self::mockTime('+30 days');
        $this->rejoin($chidi, MembershipStatus::Active, MembershipChannel::Invitation);

        self::mockTime('+6 days');
        $this->as($chidi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'thirty-six days after the switch, six after returning');

        self::mockTime('+2 days');
        $this->as($chidi, 'GET', $this->path());
        self::assertSame(ErrorCode::OrganisationTwoFactorOverdue->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aMemberApprovedLateHasSevenDaysFromTheApproval(): void
    {
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);
        $chidi = $this->account('chidi@ire.events', 'Chidi Okoro');
        $this->rejoin($chidi, MembershipStatus::PendingApproval, MembershipChannel::Request);

        self::mockTime('+10 days');
        $this->rejoin($chidi, MembershipStatus::Active, MembershipChannel::Request);

        self::mockTime('+6 days');
        $this->as($chidi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'sixteen days after asking, six after approval');
        self::assertSame(0, self::service(TwoFactorHolds::class)->recordDue());

        self::mockTime('+2 days');
        self::assertSame(1, self::service(TwoFactorHolds::class)->recordDue());
    }

    #[Test]
    public function aLagosAndALondonMemberSeeTheSameInstantInTheirOwnZones(): void
    {
        $lagos = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $london = $this->member('ada@ire.events', 'Ada Okoye', SeededRole::Coordinator);
        $this->zone($lagos, 'Africa/Lagos');
        $this->zone($london, 'Europe/London');
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        $inLagos = Type\shape(['at' => Type\string()], true)->coerce($this->standingOf($lagos)['twoFactorDue']);
        $inLondon = Type\shape(['at' => Type\string()], true)->coerce($this->standingOf($london)['twoFactorDue']);
        self::assertSame(new DateTimeImmutable($inLagos['at'])->getTimestamp(), new DateTimeImmutable($inLondon['at'])->getTimestamp());

        $mailer = self::service(UserMailer::class);
        $deadline = new DateTimeImmutable('2026-10-31 13:20:00 UTC');
        self::assertSame('Saturday 31 Oct at 14:20 WAT', $mailer->deadline($deadline, $this->fresh($lagos), 'en'));
        self::assertSame('Saturday 31 Oct at 13:20 GMT', $mailer->deadline($deadline, $this->fresh($london), 'en'));
    }

    #[Test]
    public function switchingOnAndOffIsAuditedAndSoIsEachMemberHeldBack(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);

        self::mockTime('+8 days');
        $holds = self::service(TwoFactorHolds::class);
        self::assertSame(1, $holds->recordDue());
        self::assertSame(0, $holds->recordDue(), 'each member once');
        $held = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => TwoFactorHolds::HELD]);
        self::assertSame($bisi->getId()->toRfc4122(), $held?->getChanges()['user'][1] ?? null);

        $body = $this->set(['everyoneNeedsTwoFactor' => false]);
        self::assertSame(
            [[true, false], [false, true]],
            Vec\map(
                Vec\filter(Type\vec(Type\shape(['rule' => Type\string(), 'now' => Type\mixed(), 'was' => Type\mixed()], true))->coerce($body['changes']), static fn (array $change): bool => 'everyoneNeedsTwoFactor' === $change['rule']),
                static fn (array $change): array => [$change['was'], $change['now']],
            ),
        );
        $this->as($bisi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'switching it off lets everyone back in');
    }

    #[Test]
    public function theAdministratorsRuleIsKeptWhileEveryoneNeedsTwoFactor(): void
    {
        $this->turnOnTwoFactor($this->owner);
        $this->set(['administratorsNeedTwoFactor' => true]);
        $this->set(['everyoneNeedsTwoFactor' => true]);
        $body = $this->set(['everyoneNeedsTwoFactor' => false]);

        self::assertTrue($body['administratorsNeedTwoFactor'] ?? null);
    }

    /** sc-9267: a picker switch asks before the account has saved the language, and the date follows the asking. */
    #[Test]
    public function theDeadlineIsWrittenInTheLanguageTheRequestAsksForOverTheStoredOne(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['everyoneNeedsTwoFactor' => true]);
        $this->fresh($this->owner)->setLocale('en');
        $this->fresh($bisi)->setLocale('en');
        self::em()->flush();
        $written = Type\shape(['at' => Type\string(), 'written' => Type\string()], true);

        $rules = $written->coerce($this->as($this->owner, 'GET', $this->path(), language: 'es')['twoFactorDeadline']);
        $due = $written->coerce($this->standingOf($bisi, 'fr')['twoFactorDue']);
        $unasked = $written->coerce($this->as($this->owner, 'GET', $this->path())['twoFactorDeadline']);

        $mailer = self::service(UserMailer::class);
        self::assertSame($mailer->deadline(new DateTimeImmutable($rules['at']), $this->fresh($this->owner), 'es'), $rules['written']);
        self::assertSame($mailer->deadline(new DateTimeImmutable($due['at']), $this->fresh($bisi), 'fr'), $due['written']);
        self::assertSame($mailer->deadline(new DateTimeImmutable($unasked['at']), $this->fresh($this->owner), 'en'), $unasked['written'], 'a request naming no language reads the stored one');
        self::assertNotSame($rules['written'], $unasked['written']);
    }

    /** Regression: an organisation without the rule never holds anybody back. */
    #[Test]
    public function anOrganisationWithoutTheRuleHoldsNobodyBack(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);

        self::mockTime('+30 days');

        $this->as($bisi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->standingOf($bisi)['twoFactorDue']);
    }

    /**
     * @param array<string, mixed> $rules
     *
     * @return array<string, mixed>
     */
    private function set(array $rules): array
    {
        return $this->as($this->owner, 'PATCH', $this->path(), $rules);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded): User
    {
        $user = $this->account($address, $name);
        $this->join($user, $this->organisation, $seeded);

        return $user;
    }

    private function join(User $user, Organisation $organisation, SeededRole $seeded): void
    {
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation->getId(), 'seededAs' => $seeded]);
        $managed = self::em()->find(Organisation::class, $organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($managed, $this->fresh($user), Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new Clock()->now()));
        self::em()->flush();
    }

    private function rejoin(User $user, MembershipStatus $entry, MembershipChannel $channel): void
    {
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation->getId(), 'seededAs' => SeededRole::Coordinator]);
        $managed = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::service(MembershipMachine::class)->join($managed, $this->fresh($user), Type\instance_of(Role::class)->coerce($role), $entry, $channel, $this->fresh($user));
        self::em()->flush();
    }

    private function membershipOf(User $user): Membership
    {
        return self::em()->getRepository(Membership::class)->findOneBy(['user' => $user->getId()]) ?? self::fail('no membership');
    }

    private function zone(User $user, string $zone): void
    {
        $this->fresh($user)->setTimezone($zone);
        self::em()->flush();
    }

    private function turnOnTwoFactor(User $user): void
    {
        $factor = new TwoFactorFactor($this->fresh($user), self::service(SecretBox::class)->seal(self::SECRET));
        $factor->activate(new Clock()->now());
        self::em()->persist($factor);
        self::em()->flush();
    }

    private function fresh(User $user): User
    {
        return self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
    }

    private function standingOf(User $user, ?string $language = null): array
    {
        $organisations = Type\vec(Type\shape(['id' => Type\string(), 'twoFactorDue' => Type\mixed()], true))->coerce($this->as($user, 'GET', '/api/orgs', language: $language)['organisations']);
        $mine = Iter\first(Vec\filter($organisations, fn (array $organisation): bool => $organisation['id'] === $this->organisation->getId()->toRfc4122())) ?? self::fail('not a member');

        return ['twoFactorDue' => $mine['twoFactorDue']];
    }

    /** @return list<Email> */
    private function mails(): array
    {
        return Vec\map(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && Str\ends_with((string) $message->getSubject(), 'requires two-factor'),
        ), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message));
    }

    private function path(): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/sign-in-rules';
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $language = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh($user)),
            ...(null === $language ? [] : ['HTTP_ACCEPT_LANGUAGE' => $language]),
        ], content: null === $body ? null : Json\encode([] === $body ? new stdClass() : $body));

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
