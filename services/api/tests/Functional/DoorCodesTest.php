<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\DoorCode\DoorCodeRedeemer;
use App\Domain\Event\DoorCode\DoorCodeSignIn;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\DoorCode;
use App\Entity\DoorCodeRedemption;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\Role;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\ReadsSentPhoneCodes;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\HttpFoundation\Request;

/** sc-72: a door code onto one event, made and stopped on People, redeemed with no membership; signed out, by a code to a mobile number (sc-4235). */
final class DoorCodesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use ReadsSentPhoneCodes;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $owambe;

    private string $naming;

    private int $numbers = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2030-11-01T12:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events', 'Ìrè Owner');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->owambe = $this->create('Owambe', '2030-11-14T16:00');
        $this->naming = $this->create('Naming', '2030-11-21T16:00');
    }

    #[Test]
    public function aCodeIsEightCrockfordCharactersAtItsLevelWithItsCapAndEnd(): void
    {
        $card = $this->make('can_view', 30, '2030-11-14T10:00:00+00:00', 'Bar and drinks');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        self::assertTrue(Regex\matches(Type\string()->coerce($card['code']), '/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/'));
        self::assertSame(['can_view', 'Bar and drinks', 30, 0, 'working'], [$card['role'], $card['jobLabel'], $card['useCap'], $card['used'], $card['status']]);
        self::assertSame('2030-11-14T10:00:00+00:00', $card['expiresAt']);
        self::assertTrue(Str\ends_with(Type\string()->coerce($card['link']), '/d/' . Type\string()->coerce($card['code'])), 'the QR carries the redeem address with the code in it');
        self::assertStringStartsWith('<?xml', Type\string()->coerce($card['qrSvg']));
        $made = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'door_code.made']) ?? self::fail('not audited');
        self::assertSame(['Owambe', $card['code']], [$made->getEventName(), $made->getTarget()]);

        $listed = $this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/door-codes');
        self::assertSame([$card['id']], Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($listed['doorCodes']), static fn (array $code): string => $code['id']));
    }

    #[Test]
    public function aCodeNeverOutlivesItsEvent(): void
    {
        $card = $this->make('can_check_in', 15, '2031-01-01T00:00:00+00:00');
        self::assertSame(201, $this->statusCode());

        $event = self::em()->find(DoorCode::class, Type\string()->coerce($card['id']))?->getEvent() ?? self::fail('no code');
        self::assertSame($event->getClosesAt()?->format(\DATE_ATOM), $card['expiresAt']);
    }

    /** @return iterable<string, array{0: string, 1: EventRole}> */
    public static function serviceCodes(): iterable
    {
        yield 'Can work the floor' => ['can_work_floor', EventRole::CanWorkFloor];
        yield 'Can work the pass' => ['can_work_pass', EventRole::CanWorkPass];
    }

    #[Test]
    #[DataProvider('serviceCodes')]
    public function aCodeWorksTheFloorOrThePassAndItsJoinerHoldsThatLevel(string $role, EventRole $level): void
    {
        $code = $this->code($role);
        $joined = $this->redeem($code, 'Adébáyọ̀');
        self::assertSame(200, $this->statusCode(), Json\encode($joined));

        $person = self::em()->getRepository(EventPerson::class)->findOneBy(['user' => $this->joinedAs()->getId()]) ?? self::fail('no grant');
        self::assertSame($level, $person->getRole());
    }

    #[Test]
    public function aCodeNeverRunsTheFloor(): void
    {
        $this->make('can_run_floor', 10, '2030-11-14T10:00:00+00:00');

        self::assertSame([422, ErrorCode::LevelNotAllowedForCode->type()], [$this->statusCode(), $this->last()['type'] ?? null], Json\encode($this->last()));
        self::assertSame(0, self::em()->getRepository(DoorCode::class)->count([]));
    }

    /** @return iterable<string, array{0: array<string, mixed>, 1: string}> */
    public static function refusedCodes(): iterable
    {
        yield 'Can edit' => [['role' => 'can_edit', 'useCap' => 10, 'expiresAt' => '2030-11-14T10:00:00+00:00'], 'role'];
        yield 'no cap' => [['role' => 'can_view', 'expiresAt' => '2030-11-14T10:00:00+00:00'], 'useCap'];
        yield 'a cap of 0' => [['role' => 'can_view', 'useCap' => 0, 'expiresAt' => '2030-11-14T10:00:00+00:00'], 'useCap'];
        yield 'a cap of 501' => [['role' => 'can_view', 'useCap' => 501, 'expiresAt' => '2030-11-14T10:00:00+00:00'], 'useCap'];
        yield 'no end' => [['role' => 'can_view', 'useCap' => 10], 'expiresAt'];
        yield 'an end passed' => [['role' => 'can_view', 'useCap' => 10, 'expiresAt' => '2030-11-01T11:00:00+00:00'], 'expiresAt'];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('refusedCodes')]
    public function theServerRefusesWhatTheFormRefuses(array $body, string $field): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/door-codes', $body);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([$field], Vec\map(Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($this->last()['violations'] ?? []), static fn (array $violation): string => $violation['propertyPath']));
        self::assertSame(0, self::em()->getRepository(DoorCode::class)->count([]));
    }

    #[Test]
    public function onlyWhoeverManagesPeopleSeesMakesOrStopsCodes(): void
    {
        $code = $this->code('can_check_in');
        $this->redeem($code, 'Adébáyọ̀');
        $joiner = $this->joinedAs();
        $card = $this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/door-codes')['doorCodes'];
        $id = Type\vec(Type\shape(['id' => Type\string()], true))->coerce($card)[0]['id'];

        $this->as($joiner, 'GET', '/api/events/' . $this->owambe . '/door-codes');
        self::assertContains($this->statusCode(), [403, 404]);
        $this->as($joiner, 'POST', '/api/events/' . $this->owambe . '/door-codes', ['role' => 'can_view', 'useCap' => 5, 'expiresAt' => '2030-11-14T10:00:00+00:00']);
        self::assertContains($this->statusCode(), [403, 404]);
        $this->as($joiner, 'POST', '/api/events/' . $this->owambe . '/door-codes/' . $id . '/stop');
        self::assertContains($this->statusCode(), [403, 404]);
    }

    #[Test]
    public function redeemingWithNoAccountReachesOnlyTheNamedEventAtTheCodesLevelAndMakesNoMember(): void
    {
        $code = $this->code('can_check_in', jobLabel: 'Bar and drinks');

        $opened = $this->open($code);
        self::assertSame(200, $this->statusCode(), Json\encode($opened));
        self::assertSame(['can_check_in', 'Bar and drinks', 'Owambe', 'Ìrè Events', null], [
            $opened['role'], $opened['jobLabel'], Type\shape(['name' => Type\string()], true)->coerce($opened['event'])['name'],
            Type\shape(['organisation' => Type\string()], true)->coerce($opened['event'])['organisation'], $opened['standing'],
        ]);

        $this->redeem($code, '   ');
        self::assertSame(422, $this->statusCode(), 'a name before anything');

        $joined = $this->redeem($code, 'Adébáyọ̀');
        self::assertSame(200, $this->statusCode(), Json\encode($joined));
        self::assertSame(['Adébáyọ̀', 'can_check_in', 'Bar and drinks', false], [$joined['name'], $joined['role'], $joined['jobLabel'], $joined['again']]);
        $token = Type\string()->coerce($joined['accessToken']);

        $joiner = $this->joinedAs();
        self::assertSame(AccountOrigin::Staff, $joiner->getOrigin());
        self::assertSame(0, self::em()->getRepository(Membership::class)->count(['user' => $joiner->getId()]), 'no membership row');
        $person = self::em()->getRepository(EventPerson::class)->findOneBy(['user' => $joiner->getId()]) ?? self::fail('no grant');
        self::assertSame(EventRole::CanCheckIn, $person->getRole());
        self::assertNull($person->getMembership());
        self::assertSame($code, $person->getDoorCode()?->getCode());

        $this->client->request('GET', '/api/events/' . $this->owambe, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(200, $this->statusCode(), 'in at once, nothing waiting');
        $this->client->request('GET', '/api/events/' . $this->naming, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(404, $this->statusCode(), 'a sibling event');
        $this->client->request('GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/members', server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame([404, ErrorCode::NotFound->type()], [$this->statusCode(), $this->last()['type'] ?? null], 'the organisation, as for any non-member');

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'door_code.redeemed']) ?? self::fail('not audited');
        self::assertSame([null, $code], $entry->getChanges()['code'] ?? null);
        self::assertNotNull($entry->getIp(), 'the source');

        $row = $this->peopleRow('Adébáyọ̀');
        self::assertSame($code, $row['doorCode'], "People's line ends Door code");
    }

    #[Test]
    public function aCodeTypedInAnyCaseWithSpacesAndHyphensIsTheSameCode(): void
    {
        $code = $this->code('can_view');
        $typed = Str\lowercase(Str\slice($code, 0, 4)) . ' - ' . Str\slice($code, 4);

        $this->open(\rawurlencode($typed));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aSecondRedemptionLandsOnYoureInAgainWithNoSecondGrant(): void
    {
        $code = $this->code('can_view');
        $token = Type\string()->coerce($this->redeem($code, 'Adébáyọ̀')['accessToken']);

        $this->client->request('GET', '/api/door-codes/' . $code, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame('in', $this->last()['standing'] ?? null);
        $again = $this->redeemAs($token, $code);

        self::assertSame(200, $this->statusCode(), Json\encode($again));
        self::assertTrue($again['again']);
        self::assertSame(1, self::em()->getRepository(EventPerson::class)->count(['doorCode' => $this->doorCode($code)->getId()]));
    }

    #[Test]
    public function aSignedInPersonRedeemsWithTheirAccount(): void
    {
        $code = $this->code('can_view');
        $bisi = $this->account('bisi@lagoslights.example', 'Bisi');

        $joined = $this->redeemAs($this->tokenFor($bisi), $code);

        self::assertSame(201, $this->statusCode(), Json\encode($joined));
        self::assertArrayNotHasKey('accessToken', $joined);
        self::assertNotNull(self::em()->getRepository(EventPerson::class)->findOneBy(['user' => $bisi->getId(), 'event' => $this->owambe]));
        $this->as($bisi, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function expiredStoppedAndUnknownCodesGiveTheOneSameRefusal(): void
    {
        $stopped = $this->code('can_view');
        $this->stop($stopped);
        $expiring = $this->code('can_view', expiresAt: '2030-11-02T12:00:00+00:00');

        $answers = [];
        foreach ([$stopped, 'ZZZZZZZZ', 'not a code'] as $code) {
            $this->open($code);
            $answers[$code . ' open'] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
            $this->redeem($code, 'Tolú');
            $answers[$code . ' redeem'] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
        }

        self::mockTime(new DateTimeImmutable('2030-11-02T12:00:00+00:00'));
        $this->redeem($expiring, 'Tolú');
        $answers['expired'] = [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];

        self::assertSame([[404, ErrorCode::DoorCodeInvalid->type(), 'That code does not work. Check it with whoever gave it to you.']], Vec\unique_by(Vec\values($answers), Json\encode(...)));
    }

    #[Test]
    public function aFullCodeShowsItsEventSignsItsHoldersBackInWithNoUseAndRefusesANewNumberAfterTheCode(): void
    {
        $full = $this->code('can_view', useCap: 1);
        $this->redeem($full, 'Adébáyọ̀', '+2348031110001');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $accounts = self::em()->getRepository(User::class)->count([]);

        $this->open($full);
        self::assertSame(200, $this->statusCode(), 'it shows its event, as a live code does');

        $this->sendFor($full, 'Tolú', '+2348031110002');
        self::assertSame(200, $this->statusCode(), 'and Send code answers as always');
        $this->signInFor($full, Type\string()->coerce($this->last()['handle']), $this->codeTo('+2348031110002'));
        self::assertSame([404, ErrorCode::DoorCodeInvalid->type()], [$this->statusCode(), $this->last()['type'] ?? null], 'the one refusal, after the code');
        self::assertArrayNotHasKey('accessToken', $this->last());
        self::assertSame($accounts, self::em()->getRepository(User::class)->count([]), 'no account made');
        self::assertSame(0, self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM phone_sign_ins WHERE typed_name IS NOT NULL'), 'the name typed for the refused number is stored nowhere');

        $this->sendFor($full, 'Ade', '+2348031110001');
        self::assertSame(429, $this->statusCode(), 'a code of one takes two sends an hour');
        self::assertMatchesRegularExpression('/^Too many tries\. Try again \w+day \d+ \w+ at \d\d:\d\d UTC\.$/', Type\string()->coerce($this->last()['detail'] ?? null));
        self::em()->getConnection()->executeStatement("UPDATE verification_challenges SET created_at = created_at - INTERVAL '1 hour'");
        self::em()->getConnection()->executeStatement("UPDATE phone_sign_ins SET created_at = created_at - INTERVAL '61 minutes'");
        $back = $this->redeem($full, 'Ade', '+2348031110001');
        self::assertSame(200, $this->statusCode(), Json\encode($back));
        self::assertSame(['Adébáyọ̀', true], [$back['name'], $back['again']], "the holder signs back in under the account's name");
        self::assertArrayHasKey('accessToken', $back);
        self::assertSame(1, self::em()->getRepository(DoorCodeRedemption::class)->count(['doorCode' => $this->doorCode($full)->getId()]), 'no use taken');
    }

    #[Test]
    public function anAccountOnTheEventByAnotherCodeSignsInAtThisOneWithNoSecondGrant(): void
    {
        $first = $this->code('can_view');
        $second = $this->code('can_view');
        $this->redeem($first, 'Adébáyọ̀', '+2348031110004');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->getConnection()->executeStatement("UPDATE verification_challenges SET created_at = created_at - INTERVAL '1 hour'");

        $again = $this->redeem($second, 'Adébáyọ̀', '+2348031110004');

        self::assertSame(200, $this->statusCode(), Json\encode($again));
        self::assertTrue($again['again'], "it lands on You're in again, as the signed-in redeem does");
        self::assertArrayHasKey('accessToken', $again);
        self::assertSame(0, self::em()->getRepository(DoorCodeRedemption::class)->count(['doorCode' => $this->doorCode($second)->getId()]), 'no use taken');
        self::assertSame(1, self::em()->getRepository(EventPerson::class)->count(['user' => $this->joinedAs()->getId()]), 'no second grant');
    }

    #[Test]
    public function aCodeOverItsSendsIsToldToComeBackWhenItsOldestSendLeavesTheHour(): void
    {
        $code = $this->code('can_view', useCap: 1);
        $this->sendFor($code, 'Crew', '+2348031140001');
        $this->sendFor($code, 'Crew', '+2348031140002');
        self::em()->getConnection()->executeStatement("UPDATE phone_sign_ins SET created_at = NOW() - INTERVAL '20 minutes'");

        $this->sendFor($code, 'Crew', '+2348031140003');

        self::assertSame(429, $this->statusCode(), Json\encode($this->last()));
        $wait = (int) $this->client->getResponse()->headers->get('Retry-After');
        self::assertGreaterThan(39 * 60, $wait, 'forty minutes, not a second');
        self::assertLessThanOrEqual(40 * 60 + 5, $wait);
    }

    #[Test]
    public function aSignInWhoseCodeIsNeverEnteredIsDeletedWithItsNumberNameAndCodesAfterTwentyFourHours(): void
    {
        $code = $this->code('can_view');
        $this->sendFor($code, 'Never Came', '+2348031150001');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $connection = self::em()->getConnection();

        self::mockTime('+23 hours');
        $this->prunePhoneSignIns();
        self::assertSame(1, $connection->fetchOne("SELECT COUNT(*) FROM phone_sign_ins WHERE number = '+2348031150001'"), 'kept inside its 24 hours');

        self::mockTime('+1 hour +1 minute');
        $this->prunePhoneSignIns();

        self::assertSame(0, $connection->fetchOne("SELECT COUNT(*) FROM phone_sign_ins WHERE number = '+2348031150001' OR typed_name = 'Never Came'"));
        self::assertSame(0, $connection->fetchOne('SELECT COUNT(*) FROM verification_challenges WHERE phone_sign_in_id IS NOT NULL'), 'its codes go with it');
        self::assertSame(0, self::em()->getRepository(User::class)->count(['origin' => AccountOrigin::Staff]), 'and no account was ever made');
    }

    #[Test]
    public function aNumberOnAnAccountRedeemsUnderTheAccountsNameAndTheTypedNameIsKeptNowhere(): void
    {
        $code = $this->code('can_view');
        $joanna = $this->account('joanna@bello.ng', 'Joanna Bello');
        $this->phoneOn($joanna, '+2348031110003');

        $joined = $this->redeem($code, 'Jo', '+2348031110003');

        self::assertSame(200, $this->statusCode(), Json\encode($joined));
        self::assertSame('Joanna Bello', $joined['name']);
        self::em()->clear();
        self::assertSame('Joanna Bello', self::em()->find(User::class, $joanna->getId())?->getName(), 'the account keeps its name');
        self::assertSame('Joanna Bello', self::em()->getRepository(DoorCodeRedemption::class)->findOneBy(['user' => $joanna->getId()])?->getName());
        self::assertSame(0, self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM phone_sign_ins WHERE typed_name IS NOT NULL'), 'the typed name is dropped once the code is right');
        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'door_code.redeemed']) ?? self::fail('not audited');
        self::assertSame($joanna->getId()->toRfc4122(), $entry->getActorId()?->toRfc4122());
    }

    #[Test]
    public function withTwoFactorOnInABrowserTheGrantWaitsForItAndTheSignedInRedeemTakesItWithTheSessionItIssued(): void
    {
        $code = $this->code('can_view');
        $joanna = $this->account('joanna@bello.ng', 'Joanna Bello');
        $number = '+2348031110004';
        $this->phoneOn($joanna, $number);
        $secret = $this->twoFactorOn($joanna);
        $sent = $this->sendFor($code, 'Jo', $number);

        $asked = $this->signInFor($code, Type\string()->coerce($sent['handle']), $this->codeTo($number), 'cookie');

        self::assertSame(202, $this->statusCode(), Json\encode($asked));
        self::assertArrayNotHasKey('eventId', $asked);
        self::assertSame(0, self::em()->getRepository(DoorCodeRedemption::class)->count(['doorCode' => $this->doorCode($code)->getId()]), 'nothing granted before two-factor');
        self::assertSame(0, self::em()->getRepository(AuditEntry::class)->count(['action' => 'phone.signed_in']), 'no sign-in before two-factor');

        $this->client->request('POST', '/api/auth/two-factor/verify', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:5173'], content: Json\encode([
            'challenge' => $asked['twoFactorChallenge'],
            'code' => TOTP::createFromSecret($secret)->at(Type\uint()->coerce(new Clock()->now()->getTimestamp())),
            'refreshTokenIn' => 'cookie',
        ]));
        $passed = $this->last();
        self::assertSame(200, $this->statusCode(), Json\encode($passed));
        self::assertSame(1, self::em()->getRepository(AuditEntry::class)->count(['action' => 'phone.signed_in']));

        $this->redeemAs(Type\string()->coerce($passed['accessToken']), $code);
        self::assertSame(201, $this->statusCode(), 'the signed-in redeem takes the use with the token two-factor issued: ' . Json\encode($this->last()));
        $this->client->request('POST', '/api/auth/refresh', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:5173'], content: Json\encode(['refreshTokenIn' => 'cookie']));
        self::assertSame(200, $this->statusCode(), 'and the session lasts with the grant: ' . Json\encode($this->last()));
    }

    #[Test]
    public function signedOutTheRedeemAsksForASignInAndMakesNoDeviceAccount(): void
    {
        $code = $this->code('can_view');
        $this->client->request('POST', '/api/door-codes/' . $code . '/redeem', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['name' => 'Tolú']));

        self::assertSame([401, ErrorCode::Unauthenticated->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertSame(0, self::em()->getRepository(User::class)->count(['origin' => AccountOrigin::DoorCode]));
    }

    #[Test]
    public function aVerifiedAlternativeSignsIntoNothingAndTakesNoUse(): void
    {
        $code = $this->code('can_view');
        $joanna = $this->account('joanna@bello.ng', 'Joanna Bello');
        $this->phoneOn($joanna, '+2348031110009');
        $this->phoneOn($joanna, '+2348031110005', primary: false);

        $answer = $this->redeem($code, 'Rita', '+2348031110005');

        self::assertSame(ErrorCode::PhoneAlternative->type(), $answer['type'] ?? null);
        self::assertArrayNotHasKey('accessToken', $answer);
        self::assertSame(0, self::em()->getRepository(DoorCodeRedemption::class)->count(['doorCode' => $this->doorCode($code)->getId()]));
        self::assertSame(0, self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM phone_sign_ins WHERE typed_name IS NOT NULL'), 'the name typed for the alternative is stored nowhere');
    }

    /** In one kernel, since the limiter's pool is reset between requests. */
    #[Test]
    public function sendsAreCappedAtThirtyAnHourASourceAndTwiceTheCapAnHourACode(): void
    {
        $signIn = self::service(DoorCodeSignIn::class);
        $small = $this->code('can_view', useCap: 2);

        foreach (\range(1, 4) as $n) {
            $signIn->send($small, 'Crew', '+234803112000' . $n, 'NG', Request::create('/', server: ['REMOTE_ADDR' => '203.0.113.' . $n]));
        }

        try {
            $signIn->send($small, 'Crew', '+2348031120099', 'NG', Request::create('/', server: ['REMOTE_ADDR' => '203.0.113.50']));
            self::fail('a fifth send on a code of two');
        } catch (ApiException $refusal) {
            self::assertSame(ErrorCode::TooManyAttempts, $refusal->errorCode);
        }

        $big = $this->code('can_view', useCap: 100);
        $source = Request::create('/', server: ['REMOTE_ADDR' => '198.51.100.7']);

        foreach (\range(10, 39) as $n) {
            $signIn->send($big, 'Crew', '+23480311300' . $n, 'NG', $source);
        }

        try {
            $signIn->send($big, 'Crew', '+2348031130099', 'NG', $source);
            self::fail('a thirty-first send from one source');
        } catch (ApiException $refusal) {
            self::assertSame(ErrorCode::TooManyAttempts, $refusal->errorCode);
        }
    }

    #[Test]
    public function stoppingKeepsEveryoneAlreadyIn(): void
    {
        $code = $this->code('can_view');
        $token = Type\string()->coerce($this->redeem($code, 'Adébáyọ̀')['accessToken']);

        $card = $this->stop($code);

        self::assertSame(['stopped', 1], [$card['status'], $card['used']]);
        self::assertNotNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'door_code.stopped']));
        $this->client->request('GET', '/api/events/' . $this->owambe, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(200, $this->statusCode());
        $this->redeem($code, 'Tolú');
        self::assertSame(404, $this->statusCode(), 'and lets nobody new in');
    }

    #[Test]
    public function aNewCodeTakesTheOldOnesPlaceOnPeopleAndKeepsWhoCameInByIt(): void
    {
        $old = $this->code('can_check_in', 12, jobLabel: 'Bar and drinks');
        $this->redeem($old, 'Adébáyọ̀');

        $again = ['role' => 'can_check_in', 'jobLabel' => 'Bar and drinks', 'useCap' => 12, 'expiresAt' => '2030-11-14T12:00:00+00:00', 'replaces' => $this->doorCode($old)->getId()->toRfc4122()];
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/door-codes', $again);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $fresh = Type\dict(Type\string(), Type\mixed())->coerce($body['doorCode']);
        self::assertSame(['can_check_in', 'Bar and drinks', 12, 0, 'working', '2030-11-14T12:00:00+00:00'], [$fresh['role'], $fresh['jobLabel'], $fresh['useCap'], $fresh['used'], $fresh['status'], $fresh['expiresAt']]);
        self::assertNotSame($old, $fresh['code']);
        $listed = $this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/door-codes');
        self::assertSame([$fresh['id']], Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($listed['doorCodes']), static fn (array $code): string => $code['id']), 'the replaced code leaves People');
        $this->redeem($old, 'Tolú');
        self::assertSame(404, $this->statusCode(), 'the old code lets nobody new in');
        self::assertSame($old, $this->peopleRow('Adébáyọ̀')['doorCode'], 'whoever came in by it stays, with the code they used');

        $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/door-codes', $again);
        self::assertSame(404, $this->statusCode(), 'a code is replaced once');
        $this->as($this->owner, 'POST', '/api/events/' . $this->naming . '/door-codes', [...$again, 'replaces' => $fresh['id']]);
        self::assertSame(404, $this->statusCode(), 'and only from its own event');
        self::assertNull($this->doorCode(Type\string()->coerce($fresh['code']))->getStoppedAt(), 'a refused replacement stops nothing');
    }

    #[Test]
    public function aStoppedCodeThatNobodyRemadeStaysOnPeople(): void
    {
        $code = $this->code('can_view');
        $this->stop($code);
        $this->make('can_view', 10, '2030-11-14T10:00:00+00:00', 'with no replaces');

        $listed = $this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/door-codes');
        self::assertSame(['working', 'stopped'], Vec\map(Type\vec(Type\shape(['status' => Type\string()], true))->coerce($listed['doorCodes']), static fn (array $one): string => $one['status']));
    }

    #[Test]
    public function aPersonRemovedOnPeopleCannotComeBackWithTheSameLiveCode(): void
    {
        $code = $this->code('can_view');
        $token = Type\string()->coerce($this->redeem($code, 'Adébáyọ̀')['accessToken']);
        $row = $this->peopleRow('Adébáyọ̀');

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->owambe . '/people/' . Type\string()->coerce($row['id']));
        self::assertSame(204, $this->statusCode());

        $this->redeemAs($token, $code);
        self::assertSame([404, ErrorCode::DoorCodeInvalid->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertNull(self::em()->getRepository(EventPerson::class)->findOneBy(['doorCode' => $this->doorCode($code)->getId()]));
    }

    #[Test]
    public function aMemberWhoOpensACodeGetsNoGrant(): void
    {
        $code = $this->code('can_view');
        $member = $this->member('ada@ire.events', SeededRole::Member, 'Ada');

        $this->client->request('GET', '/api/door-codes/' . $code, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $this->tokenFor($member)]);
        self::assertSame('member', $this->last()['standing'] ?? null);
        $this->redeemAs($this->tokenFor($member), $code);

        self::assertSame([409, ErrorCode::AlreadyAMember->type()], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertNull(self::em()->getRepository(EventPerson::class)->findOneBy(['user' => $member->getId(), 'doorCode' => $this->doorCode($code)->getId()]));
    }

    /** In one kernel, since the limiter's pool is reset between requests. */
    #[Test]
    public function aSourceGetsTenWrongCodesAMinuteThenEvenTheRightOneIsRefused(): void
    {
        $code = $this->code('can_view');
        $redeemer = self::service(DoorCodeRedeemer::class);
        $source = Request::create('/api/door-codes/ZZZZZZZZ', server: ['REMOTE_ADDR' => '203.0.113.9']);

        foreach (\range(1, 10) as $try) {
            try {
                $redeemer->open('ZZZZZZZZ', null, $source);
                self::fail('a code that does not exist');
            } catch (ApiException $refusal) {
                self::assertSame(ErrorCode::DoorCodeInvalid, $refusal->errorCode, 'try ' . $try);
            }
        }

        try {
            $redeemer->open($code, null, $source);
            self::fail('the eleventh try in the minute');
        } catch (ApiException $refusal) {
            self::assertSame(ErrorCode::TooManyAttempts, $refusal->errorCode);
        }

        self::assertSame($code, $redeemer->open($code, null, Request::create('/', server: ['REMOTE_ADDR' => '198.51.100.4']))->getCode(), 'another source');
    }

    #[Test]
    public function aSpentSourceIsToldWhenToTryAgain(): void
    {
        $code = $this->code('can_view');
        self::getContainer()->set('limiter.door_code_source', new RefusingRateLimiterFactory(new DateTimeImmutable('2030-11-01T12:01:00Z')));

        $this->open($code);

        self::assertSame(429, $this->statusCode());
        self::assertSame(ErrorCode::TooManyAttempts->type(), $this->last()['type'] ?? null);
        self::assertMatchesRegularExpression('/^\w+day \d+ \w+ at \d\d:\d\d UTC$/', Type\string()->coerce($this->last()['retryAt'] ?? null));
        self::assertMatchesRegularExpression('/^Too many tries\. Try again \w+day \d+ \w+ at \d\d:\d\d UTC\.$/', Type\string()->coerce($this->last()['detail'] ?? null));
    }

    /** In one kernel, since the limiter's pool is reset between requests. */
    #[Test]
    public function aRightCodeSpendsNothingOfTheSourcesTen(): void
    {
        $code = $this->code('can_view');
        $redeemer = self::service(DoorCodeRedeemer::class);
        $source = Request::create('/', server: ['REMOTE_ADDR' => '203.0.113.9']);

        foreach (\range(1, 15) as $n) {
            self::assertSame($code, $redeemer->open($code, null, $source)->getCode(), 'fifteen waiters on one venue network, ' . $n);
        }

        try {
            $redeemer->open('ZZZZZZZZ', null, $source);
            self::fail('a code that does not exist');
        } catch (ApiException $refusal) {
            self::assertSame(ErrorCode::DoorCodeInvalid, $refusal->errorCode, 'the source has its ten still');
        }
    }

    /** In one kernel, since the limiter's pool is reset between requests. */
    #[Test]
    public function aWorkingCodeOpenedAndJoinedPastItsHundredAndTwentyIsNeverRefused(): void
    {
        $code = $this->code('can_view', useCap: 100);
        $redeemer = self::service(DoorCodeRedeemer::class);

        foreach (\range(1, 65) as $n) {
            $source = Request::create('/', server: ['REMOTE_ADDR' => '203.0.113.9']);
            $crew = new User('Crew ' . $n, null, AccountOrigin::Staff);
            self::em()->persist($crew);
            self::assertSame($code, $redeemer->open($code, null, $source)->getCode(), 'open ' . $n);
            self::assertFalse($redeemer->redeem($code, $crew, $source)['again'], 'join ' . $n);
        }
    }

    /** In one kernel, since the limiter's pool is reset between requests. */
    #[Test]
    public function aCodeGetsAHundredAndTwentyRefusedTriesAMinuteFromAnySourceThenIsRefusedForBeingBusy(): void
    {
        $redeemer = self::service(DoorCodeRedeemer::class);

        foreach (\range(0, 119) as $try) {
            try {
                $redeemer->open('ZZZZZZZZ', null, Request::create('/', server: ['REMOTE_ADDR' => '203.0.113.' . (1 + Math\div($try, 10))]));
                self::fail('a code that does not exist');
            } catch (ApiException $refusal) {
                self::assertSame(ErrorCode::DoorCodeInvalid, $refusal->errorCode, 'try ' . ($try + 1));
            }
        }

        try {
            $redeemer->open('ZZZZZZZZ', null, Request::create('/', server: ['REMOTE_ADDR' => '198.51.100.4']));
            self::fail('the hundred and twenty-first refused try in the minute');
        } catch (ApiException $busy) {
            self::assertSame(ErrorCode::TooManyAttempts, $busy->errorCode);
        }
    }

    #[Test]
    public function aDoorCodesAccountReachesNothingButItsEventAndItself(): void
    {
        $token = Type\string()->coerce($this->redeem($this->code('can_view'), 'Adébáyọ̀')['accessToken']);

        $this->client->request('POST', '/api/orgs', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer ' . $token], content: Json\encode(['name' => 'Stranger Events', 'country' => 'NG', 'timeZone' => 'Africa/Lagos']));
        self::assertSame([403, ErrorCode::AccountUnverified->type()], [$this->statusCode(), $this->last()['type'] ?? null], 'founding an organisation');
        $this->client->request('GET', '/api/orgs', server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(200, $this->statusCode(), 'any other signed-in route answers as for a non-member');
        self::assertSame([], $this->last()['organisations'] ?? null);
        $this->client->request('GET', '/api/auth/me', server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(200, $this->statusCode(), 'itself');
        $this->client->request('GET', '/api/events/' . $this->owambe, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(200, $this->statusCode(), 'its event');
    }

    /** @return array<string, mixed> */
    private function make(string $role, ?int $useCap, ?string $expiresAt, ?string $jobLabel = null): array
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/door-codes', ['role' => $role, 'jobLabel' => $jobLabel, 'useCap' => $useCap, 'expiresAt' => $expiresAt]);

        return Type\dict(Type\string(), Type\mixed())->coerce($body['doorCode'] ?? []);
    }

    private function code(string $role, int $useCap = 30, string $expiresAt = '2030-11-14T10:00:00+00:00', ?string $jobLabel = null): string
    {
        $card = $this->make($role, $useCap, $expiresAt, $jobLabel);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\string()->coerce($card['code']);
    }

    /** @return array<string, mixed> */
    private function stop(string $code): array
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/door-codes/' . $this->doorCode($code)->getId()->toRfc4122() . '/stop');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['doorCode']);
    }

    /** @return array<string, mixed> */
    private function open(string $code): array
    {
        $this->client->request('GET', '/api/door-codes/' . $code);

        return $this->last();
    }

    /**
     * Signed out: the name and a number, then the code sent to it; a new number each time unless one is given.
     *
     * @return array<string, mixed>
     */
    private function redeem(string $code, string $name, ?string $number = null): array
    {
        $number ??= '+23480311101' . Str\pad_left((string) ++$this->numbers, 2, '0');
        $sent = $this->sendFor($code, $name, $number);

        if (200 !== $this->statusCode()) {
            return $sent;
        }

        return $this->signInFor($code, Type\string()->coerce($sent['handle']), $this->codeTo($number));
    }

    /** @return array<string, mixed> */
    private function sendFor(string $code, string $name, string $number): array
    {
        $this->client->request('POST', '/api/door-codes/' . \rawurlencode($code) . '/sign-in/send', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['name' => $name, 'number' => $number, 'countryCode' => 'NG']));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function signInFor(string $code, #[SensitiveParameter] string $handle, #[SensitiveParameter] string $phoneCode, string $delivery = 'body'): array
    {
        $this->client->request('POST', '/api/door-codes/' . \rawurlencode($code) . '/sign-in', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:5173'], content: Json\encode(['handle' => $handle, 'code' => $phoneCode, 'refreshTokenIn' => $delivery]));

        return $this->last();
    }

    private function prunePhoneSignIns(): void
    {
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:prune-phone-sign-ins'));
        $tester->execute([]);
        $tester->assertCommandIsSuccessful();
    }

    /** @return non-empty-string the authenticator's secret */
    private function twoFactorOn(User $user): string
    {
        $secret = Type\non_empty_string()->coerce(TOTP::generate()->getSecret());
        $factor = new TwoFactorFactor(self::em()->find(User::class, $user->getId()) ?? self::fail('no user'), self::service(SecretBox::class)->seal($secret));
        $factor->activate(new DateTimeImmutable());
        self::em()->persist($factor);
        self::em()->flush();

        return $secret;
    }

    private function phoneOn(User $user, string $number, bool $primary = true): void
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $phone = new PhoneNumber($who, $number, $primary, 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        $who->addPhoneNumber($phone);
        self::em()->persist($phone);
        self::em()->flush();
    }

    /** @return array<string, mixed> */
    private function redeemAs(#[SensitiveParameter] string $token, string $code): array
    {
        $this->client->request('POST', '/api/door-codes/' . $code . '/redeem', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer ' . $token], content: '{}');

        return $this->last();
    }

    private function doorCode(string $code): DoorCode
    {
        return self::em()->getRepository(DoorCode::class)->findOneBy(['code' => $code]) ?? self::fail('no code ' . $code);
    }

    private function joinedAs(): User
    {
        self::em()->clear();

        return self::em()->getRepository(User::class)->findOneBy(['origin' => AccountOrigin::Staff]) ?? self::fail('no account made at the door');
    }

    /** @return array<string, mixed> */
    private function peopleRow(string $name): array
    {
        $people = $this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/people');

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($people['people'] ?? []) as $row) {
            if ($name === (Type\nullable(Type\shape(['name' => Type\string()], true))->coerce($row['user'])['name'] ?? null)) {
                return $row;
            }
        }

        self::fail('nobody called ' . $name . ' in ' . Json\encode($people));
    }

    private function create(string $name, string $startsAt): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => $name, 'type' => 'wedding', 'startsAt' => $startsAt, 'endsAt' => $startsAt, 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'])['id'];
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, string $name): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function tokenFor(User $user): string
    {
        return self::service(JWTTokenManagerInterface::class)->create(self::em()->find(User::class, $user->getId()) ?? self::fail('no user'));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->tokenFor($user),
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
