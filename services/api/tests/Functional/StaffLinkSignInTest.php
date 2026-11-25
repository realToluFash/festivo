<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Staff\Link\StaffLinkGrants;
use App\Domain\Staff\Link\StaffLinks;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\EmailAddress;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\RefreshToken;
use App\Entity\StaffMember;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\ErrorCode;
use App\Tests\ApiTestCase;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\ReadsSentPhoneCodes;
use DateTimeImmutable;
use DateTimeZone;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Signing in at the end of a staff link with one code to the roster entry's number (sc-4235). */
final class StaffLinkSignInTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use InvitesPeople;
    use OnboardsAccounts;
    use ReadsSentPhoneCodes;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NUMBER = '+2348031110009';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $jobId;

    private string $ada;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-06T17:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->jobId = $this->newJob('Bar door', 'check_in');
        $this->ada = $this->person('Ada Obi', '0803 111 0009', $this->jobId);
        $this->onShift($this->ada, $this->jobId);
    }

    #[Test]
    public function theFirstCodeOnANumberWithNoAccountMakesOneWithTheRosterNameAndTheNumberAlone(): void
    {
        $token = $this->link($this->ada);
        $handle = $this->send($token);
        self::assertNull($this->accountOn(self::NUMBER), 'no account before the code');

        $answer = $this->signIn($token, $handle, $this->codeTo(self::NUMBER));

        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        $user = $this->accountOn(self::NUMBER) ?? self::fail('no account');
        self::assertSame('Ada Obi', $user->getName());
        self::assertSame(AccountOrigin::Staff, $user->getOrigin());
        self::assertSame([], $user->getEmailAddresses());
        self::assertNull($user->getPassword());
        self::assertTrue($user->isVerified());
        self::assertSame($user->getId()->toRfc4122(), $this->entry($this->ada)->getAccount()?->getId()->toRfc4122());
        self::assertSame('Ada Obi', Type\shape(['name' => Type\string()], true)->coerce($answer['account'] ?? null)['name']);
        self::assertTrue($this->audited('phone.account_made'));
        self::assertTrue($this->audited('staff.account_linked'));
        self::assertTrue($this->audited('phone.signed_in'));
    }

    #[Test]
    public function aCodeSentAndNeverAcceptedLeavesNoAccountBehind(): void
    {
        $token = $this->link($this->ada);
        $handle = $this->send($token);
        $this->signIn($token, $handle, '000000' === $this->codeTo(self::NUMBER) ? '111111' : '000000');

        self::assertSame(422, $this->statusCode());
        self::assertNull($this->accountOn(self::NUMBER));
        self::assertSame(0, self::em()->getRepository(User::class)->count(['origin' => AccountOrigin::Staff]));
    }

    #[Test]
    public function aNumberThatIsAVerifiedAccountsPrimarySignsIntoItAndMakesNoSecond(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, self::NUMBER, primary: true, verified: true);
        $token = $this->link($this->ada);

        $answer = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));

        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        self::assertSame($kemi->getId()->toRfc4122(), $this->entry($this->ada)->getAccount()?->getId()->toRfc4122());
        self::assertSame(0, self::em()->getRepository(User::class)->count(['origin' => AccountOrigin::Staff]));
        self::assertSame('Kemi Ade', Type\shape(['name' => Type\string()], true)->coerce($answer['account'] ?? null)['name']);
    }

    #[Test]
    public function withTwoFactorOnTheAuthenticatorIsAskedNextNamingTheEmail(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, self::NUMBER, primary: true, verified: true);
        $this->twoFactorOn($kemi);
        $token = $this->link($this->ada);

        $answer = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));

        self::assertSame(202, $this->statusCode(), Json\encode($answer));
        self::assertSame('kemi@ade.ng', $answer['email']);
        self::assertNull($answer['phone']);
        self::assertArrayNotHasKey('accessToken', $answer);
        self::assertFalse(Str\contains(Json\encode($answer), 'Kemi'));
    }

    #[Test]
    public function withTwoFactorOnTheEntryIsLinkedAndTheSignInAuditedOnlyOnceItPasses(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, self::NUMBER, primary: true, verified: true);
        $secret = $this->twoFactorOn($kemi);
        $token = $this->link($this->ada);

        $asked = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER), 'cookie');

        self::assertSame(202, $this->statusCode(), Json\encode($asked));
        self::assertNull($this->entry($this->ada)->getAccount(), 'the phone alone links nothing');
        self::assertFalse($this->audited('staff.account_linked'));
        self::assertFalse($this->audited('phone.signed_in'));

        $this->verify($asked, $secret);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($kemi->getId()->toRfc4122(), $this->entry($this->ada)->getAccount()?->getId()->toRfc4122());
        self::assertTrue($this->audited('staff.account_linked'));
        self::assertTrue($this->audited('phone.signed_in'));
    }

    #[Test]
    public function withTwoFactorOnAndNoEmailTheStepNamesTheMaskedNumberAlone(): void
    {
        $token = $this->link($this->ada);
        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));
        $this->twoFactorOn($this->accountOn(self::NUMBER) ?? self::fail('no account'));
        self::em()->getConnection()->executeStatement("UPDATE verification_challenges SET created_at = created_at - INTERVAL '1 hour'");

        $answer = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));

        self::assertSame(202, $this->statusCode(), Json\encode($answer));
        self::assertNull($answer['email']);
        self::assertSame(['countryCode' => 'NG', 'lastDigits' => '0009'], $answer['phone']);
        self::assertFalse(Str\contains(Json\encode($answer), 'Ada'));
        self::assertFalse(Str\contains(Json\encode($answer), '8031110009'));
    }

    #[Test]
    public function anAccountWithNoEmailLabelsItsAuthenticatorEntryWithItsNumber(): void
    {
        $token = $this->link($this->ada);
        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));
        $account = $this->accountOn(self::NUMBER) ?? self::fail('no account');

        $enrolled = $this->as($account, 'POST', '/api/auth/two-factor/enrol');

        self::assertStringStartsWith('otpauth://totp/Soirely%3A%2B2348031110009?', Type\string()->coerce($enrolled['otpauthUri']));
    }

    #[Test]
    public function anAccountWithAnEmailKeepsItAsTheAuthenticatorLabel(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, self::NUMBER, primary: true, verified: true);

        $enrolled = $this->as($kemi, 'POST', '/api/auth/two-factor/enrol');

        self::assertStringStartsWith('otpauth://totp/Soirely%3Akemi%40ade.ng?', Type\string()->coerce($enrolled['otpauthUri']));
    }

    #[Test]
    public function aPhoneOnlyAccountIsRefusedAnInvitationUntilItHasTheAddressVerified(): void
    {
        $token = $this->link($this->ada);
        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));
        $account = $this->accountOn(self::NUMBER) ?? self::fail('no account');
        [$invitation, $link] = self::invitationTo('ada@obi.ng');

        $preview = $this->as($account, 'POST', '/api/invitations/link', ['token' => $link]);
        self::assertTrue($preview['needsEmail']);
        self::assertNull($preview['signedInAs']);
        self::assertSame(['countryCode' => 'NG', 'lastDigits' => '0009'], $preview['signedInAsPhone']);

        $refused = $this->as($account, 'POST', '/api/invitations/' . $invitation->getId()->toRfc4122() . '/accept');
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::InvitationNeedsEmail->type(), $refused['type']);

        $user = self::em()->find(User::class, $account->getId()) ?? self::fail('no user');
        $address = new EmailAddress($user, 'ada@obi.ng', true);
        $address->setVerifiedAt(new DateTimeImmutable());
        $user->addEmailAddress($address);
        self::em()->persist($address);
        self::em()->flush();

        self::assertFalse($this->as($account, 'POST', '/api/invitations/link', ['token' => $link])['needsEmail']);
        $this->as($account, 'POST', '/api/invitations/' . $invitation->getId()->toRfc4122() . '/accept');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aVerifiedAlternativeOnAnotherAccountSignsIntoNothingAndSaysSoOnlyAfterTheRightCode(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, '+2348031119999', primary: true, verified: true);
        $this->phone($kemi, self::NUMBER, primary: false, verified: true);
        $token = $this->link($this->ada);
        $handle = $this->send($token);
        $sent = $this->last();

        self::assertSame(['handle', 'cooldownSeconds'], Vec\keys($sent));

        $this->signIn($token, $handle, '000000' === $this->codeTo(self::NUMBER) ? '111111' : '000000');
        self::assertSame('verification_code_invalid', $this->errorCode());

        $answer = $this->signIn($token, $handle, $this->codeTo(self::NUMBER));

        self::assertSame(409, $this->statusCode(), Json\encode($answer));
        self::assertSame('phone_alternative', $this->errorCode());
        self::assertFalse(Str\contains(Json\encode($answer), 'Kemi'));
        self::assertFalse(Str\contains(Json\encode($answer), 'kemi@'));
        self::assertNull($this->entry($this->ada)->getAccount());
        self::assertSame(0, self::em()->getRepository(User::class)->count(['origin' => AccountOrigin::Staff]));
        self::assertSame($kemi->getId()->toRfc4122(), $this->ownerOf(self::NUMBER));
    }

    #[Test]
    public function anUnverifiedNumberOnAnotherAccountIsReleasedByTheRightCodeAndNeverSignsIntoIt(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, self::NUMBER, primary: true, verified: false);
        $token = $this->link($this->ada);

        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $made = $this->accountOn(self::NUMBER) ?? self::fail('no account');
        self::assertNotSame($kemi->getId()->toRfc4122(), $made->getId()->toRfc4122());
        self::assertSame('Ada Obi', $made->getName());
    }

    #[Test]
    public function aSecondSendInsideTheCooldownWaitsAsAResendDoes(): void
    {
        $token = $this->link($this->ada);
        $this->send($token);

        $this->post('/api/staff-links/sign-in/send', ['token' => $token]);

        self::assertSame(429, $this->statusCode());
        self::assertNotNull($this->client->getResponse()->headers->get('Retry-After'));
    }

    #[Test]
    public function signedInThroughTheLinkTheAccountHoldsTheJobsLevelAndNothingAbove(): void
    {
        $user = $this->signedIn();

        $this->as($user, 'GET', '/api/events/' . $this->eventId . '/guests');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($user, 'PATCH', '/api/events/' . $this->eventId, ['name' => 'Renamed']);
        self::assertSame(403, $this->statusCode());

        $this->as($user, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/members');
        self::assertContains($this->statusCode(), [403, 404]);
    }

    #[Test]
    public function aJobAboveCheckingInStillHoldsNoMoreThanReading(): void
    {
        $this->jobAccess('run');
        $user = $this->signedIn();

        self::assertSame('can_view', $this->outsideRole($user));
    }

    #[Test]
    public function aJobsLevelChangedOnTheNightAppliesOnTheNextRequest(): void
    {
        $user = $this->signedIn();
        self::assertSame('can_check_in', $this->outsideRole($user));

        $this->jobAccess('view');

        self::assertSame('can_view', $this->outsideRole($user));
    }

    #[Test]
    public function replacingTheLinkEndsTheGrantAtOnce(): void
    {
        $user = $this->signedIn();
        $this->as($this->owner, 'POST', $this->path($this->ada . '/link/replace'));

        $this->as($user, 'GET', '/api/events/' . $this->eventId . '/guests');

        self::assertContains($this->statusCode(), [403, 404]);
    }

    #[Test]
    public function theSignInCodeIsSentWithNoMessageCreditsAndChargesNothing(): void
    {
        self::em()->getConnection()->executeStatement('UPDATE billing_accounts SET credit_balance = 0');
        $before = self::em()->getConnection()->fetchOne('SELECT SUM(credit_balance) FROM billing_accounts');
        $token = $this->link($this->ada);

        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($before, self::em()->getConnection()->fetchOne('SELECT SUM(credit_balance) FROM billing_accounts'));
    }

    #[Test]
    public function signedInAsTheEntrysAccountTheLinkSaysYoursAndAnotherAccountIsToldWhoseItIs(): void
    {
        $user = $this->signedIn();
        $token = $this->link($this->ada);

        $this->as($user, 'POST', '/api/staff-links/look', ['token' => $token]);
        self::assertSame(['yours', null, null], [$this->last()['reader'] ?? null, $this->last()['name'] ?? null, $this->last()['signedOutAt'] ?? null], 'a session that does not end with the grants names no sign-out time');

        $this->as($this->account('sam@okafor.ng', 'Samuel Okafor'), 'POST', '/api/staff-links/look', ['token' => $token]);
        self::assertSame(['other', 'Ada Obi'], [$this->last()['reader'] ?? null, $this->last()['name'] ?? null]);
    }

    #[Test]
    public function aBrowserSessionEndsWithTheLastLiveGrantAndAtOnceWhenItIsRevokedEarly(): void
    {
        $token = $this->link($this->ada);
        $answer = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER), 'cookie');
        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        $chain = self::em()->getRepository(RefreshToken::class)->findOneBy(['user' => $this->accountOn(self::NUMBER)]) ?? self::fail('no session');
        self::assertTrue($chain->endsWithGrants());

        $this->refresh();
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'POST', $this->path($this->ada . '/link/replace'));
        $this->refresh();

        self::assertSame(401, $this->statusCode());
    }

    #[Test]
    public function signedInInABrowserTheLinkIsTheEntrysOwnAndSaysWhenItSignsOut(): void
    {
        $token = $this->link($this->ada);
        $answer = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER), 'cookie');
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        $this->client->request('POST', '/api/staff-links/look', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . Type\string()->coerce($answer['accessToken']),
        ], content: Json\encode(['token' => $token]));

        $ends = self::service(StaffLinkGrants::class)->lastEndFor($this->accountOn(self::NUMBER) ?? self::fail('no account')) ?? self::fail('no grant');
        self::assertSame(
            ['yours', $ends->setTimezone(new DateTimeZone('Africa/Lagos'))->format(\DATE_ATOM), 'Africa/Lagos'],
            [$this->last()['reader'] ?? null, $this->last()['signedOutAt'] ?? null, $this->last()['timeZone'] ?? null],
            Json\encode($this->last()),
        );
    }

    #[Test]
    public function aBrowserSessionIsRefusedOnceTheWindowHasEnded(): void
    {
        $token = $this->link($this->ada);
        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER), 'cookie');
        $this->at('2027-03-07T00:00:00Z');

        $this->refresh();

        self::assertSame(401, $this->statusCode());
    }

    #[Test]
    public function aBrowserSignInCloseToTheWindowsEndHoldsAnAccessTokenEndingWithIt(): void
    {
        $until = $this->closeToTheEnd();
        $token = $this->link($this->ada);

        $answer = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER), 'cookie');

        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        self::assertSame($until->getTimestamp(), $this->expiryOf($answer));
    }

    #[Test]
    public function withTwoFactorOnABrowserSignInCloseToTheWindowsEndHoldsAnAccessTokenEndingWithIt(): void
    {
        $kemi = $this->account('kemi@ade.ng', 'Kemi Ade');
        $this->phone($kemi, self::NUMBER, primary: true, verified: true);
        $secret = $this->twoFactorOn($kemi);
        $until = $this->closeToTheEnd();
        $token = $this->link($this->ada);
        $asked = $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER), 'cookie');

        $answer = $this->verify($asked, $secret);

        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        self::assertSame($until->getTimestamp(), $this->expiryOf($answer));
    }

    #[Test]
    public function anAppSessionKeepsTheUsualLife(): void
    {
        $token = $this->link($this->ada);
        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));
        $chain = self::em()->getRepository(RefreshToken::class)->findOneBy(['user' => $this->accountOn(self::NUMBER)]) ?? self::fail('no session');

        self::assertFalse($chain->endsWithGrants());
    }

    #[Test]
    public function deletingTheStaffAccountLeavesTheRosterEntryItsNameAndNoLink(): void
    {
        $user = $this->signedIn();
        self::em()->remove(self::em()->find(User::class, $user->getId()) ?? self::fail('no user'));
        self::em()->flush();
        self::em()->clear();

        $entry = $this->entry($this->ada);
        self::assertNull($entry->getAccount());
        self::assertSame('Ada Obi', $entry->getFullName());
    }

    private function signedIn(): User
    {
        $token = $this->link($this->ada);
        $this->signIn($token, $this->send($token), $this->codeTo(self::NUMBER));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $this->accountOn(self::NUMBER) ?? self::fail('no account');
    }

    private function outsideRole(User $user): ?string
    {
        $outside = Type\vec(Type\shape(['id' => Type\string(), 'role' => Type\string()], true))->coerce($this->as($user, 'GET', '/api/auth/me')['outsideEvents'] ?? null);

        return Iter\search($outside, fn (array $one): bool => $one['id'] === $this->eventId)['role'] ?? null;
    }

    private function refresh(): void
    {
        $this->client->request('POST', '/api/auth/refresh', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:5173'], content: Json\encode(['refreshTokenIn' => 'cookie']));
    }

    private function link(string $staffId): string
    {
        $answer = $this->as($this->owner, 'POST', $this->path($staffId . '/link'));
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        return Str\after_last(Type\string()->coerce($answer['url'] ?? null), '/') ?? self::fail('no token');
    }

    private function send(#[SensitiveParameter] string $token): string
    {
        $this->post('/api/staff-links/sign-in/send', ['token' => $token]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\string()->coerce($this->last()['handle'] ?? null);
    }

    /** @return array<string, mixed> */
    private function signIn(#[SensitiveParameter] string $token, #[SensitiveParameter] string $handle, #[SensitiveParameter] string $code, string $delivery = 'body'): array
    {
        $this->post('/api/staff-links/sign-in', ['token' => $token, 'handle' => $handle, 'code' => $code, 'refreshTokenIn' => $delivery]);

        return $this->last();
    }

    private function accountOn(string $number): ?User
    {
        self::em()->clear();

        return self::em()->getRepository(PhoneNumber::class)->findOneBy(['number' => $number])?->getUser();
    }

    private function ownerOf(string $number): ?string
    {
        return $this->accountOn($number)?->getId()->toRfc4122();
    }

    private function entry(string $staffId): StaffMember
    {
        self::em()->clear();

        return self::em()->find(StaffMember::class, $staffId) ?? self::fail('no entry');
    }

    private function audited(string $action): bool
    {
        return (int) self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_entries WHERE action = ?', [$action]) > 0;
    }

    private function phone(User $user, string $number, bool $primary, bool $verified): void
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $phone = new PhoneNumber($who, $number, $primary, 'NG');
        $phone->setVerifiedAt($verified ? new DateTimeImmutable() : null);
        $who->addPhoneNumber($phone);
        self::em()->persist($phone);
        self::em()->flush();
    }

    /**
     * @param array<string, mixed> $asked
     * @param non-empty-string     $secret
     *
     * @return array<string, mixed>
     */
    private function verify(array $asked, #[SensitiveParameter] string $secret): array
    {
        $this->client->request('POST', '/api/auth/two-factor/verify', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:5173'], content: Json\encode([
            'challenge' => $asked['twoFactorChallenge'],
            'code' => TOTP::createFromSecret($secret)->at(Type\uint()->coerce(new Clock()->now()->getTimestamp())),
            'refreshTokenIn' => 'cookie',
        ]));

        return $this->last();
    }

    /** Five minutes before Ada's window ends, well inside an access token's usual life. */
    private function closeToTheEnd(): DateTimeImmutable
    {
        $until = self::service(StaffLinks::class)->window($this->entry($this->ada))->until ?? self::fail('no window');
        $this->at($until->modify('-5 minutes')->format(\DATE_ATOM));

        return $until;
    }

    /** @param array<string, mixed> $answer */
    private function expiryOf(array $answer): int
    {
        $claims = self::service(JWTTokenManagerInterface::class)->parse(Type\string()->coerce($answer['accessToken'] ?? null));

        return Type\int()->coerce($claims['exp'] ?? null);
    }

    /** @return non-empty-string */
    private function twoFactorOn(User $user): string
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $secret = Type\non_empty_string()->coerce(TOTP::generate()->getSecret());
        $factor = new TwoFactorFactor($who, self::service(SecretBox::class)->seal($secret));
        $factor->activate(new DateTimeImmutable());
        self::em()->persist($factor);
        self::em()->flush();

        return $secret;
    }

    private function jobAccess(string $access): void
    {
        $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->jobId), ['name' => 'Bar door', 'access' => $access]);
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
    }

    private function at(string $instant): void
    {
        self::mockTime(new DateTimeImmutable($instant));
    }

    private function onShift(string $staffId, string $jobId): void
    {
        $this->as($this->owner, 'POST', $this->path('shifts'), ['job' => $jobId, 'startsAt' => '2027-03-06T18:00', 'endsAt' => '2027-03-06T23:00', 'needed' => 1]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $shifts = Type\vec(Type\shape(['id' => Type\string(), 'job' => Type\string()], true))->coerce($this->last()['shifts'] ?? null);
        $shift = Iter\search($shifts, static fn (array $one): bool => $one['job'] === $jobId) ?? self::fail('no shift');
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shift['id'] . '/people/' . $staffId));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
    }

    private function person(string $name, string $mobile, string $jobId): string
    {
        $this->as($this->owner, 'POST', $this->path(''), ['fullName' => $name, 'job' => $jobId, 'mobile' => ['countryCode' => 'NG', 'number' => $mobile]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    private function newJob(string $name, string $access): string
    {
        $this->as($this->owner, 'POST', $this->path('jobs'), ['name' => $name, 'access' => $access]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $jobs = Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['jobs'] ?? null);

        return (Iter\search($jobs, static fn (array $job): bool => $name === $job['name']) ?? self::fail('no job ' . $name))['id'];
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T02:00',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function path(string $rest): string
    {
        return '' === $rest ? '/api/events/' . $this->eventId . '/staff' : '/api/events/' . $this->eventId . '/staff/' . $rest;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed> $body */
    private function post(string $path, array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
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
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function errorCode(): ?string
    {
        return Str\after_last(Type\string()->coerce($this->last()['type'] ?? ''), '/');
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
