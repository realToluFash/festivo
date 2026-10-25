<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\ProviderIdentity;
use App\Entity\Role;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;
use Symfony\Contracts\Translation\TranslatorInterface;

final class SignInRulesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string SECRET = 'JBSWY3DPEHPK3PXP';

    private const string WRONG = 'not the password at all';

    /** @mago-expect lint:no-literal-password */
    private const string NEW_PASSWORD = 'another decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('folake@ire.events', 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->linkProvider($this->owner, 'g-folake');
    }

    #[Test]
    public function aLinkedMemberIsRefusedAPasswordUnderGoogleOrAppleOnly(): void
    {
        $this->set(['providerOnly' => true]);

        $body = $this->signIn('folake@ire.events');

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OAuthOnly->type(), $body['type'] ?? null);
        self::assertSame('Ìrè Events', $body['organisation'] ?? null);
        self::assertSame(['google'], $body['providers'] ?? null);
        self::assertSame('folake@ire.events', $body['email'] ?? null, 'sign-in fills in the address beside the provider buttons');
    }

    #[Test]
    public function aWrongPasswordIsStillAWrongPasswordUnderTheRule(): void
    {
        $this->set(['providerOnly' => true]);

        $this->client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['email' => 'folake@ire.events', 'password' => self::WRONG]));

        self::assertSame(ErrorCode::InvalidCredentials->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function theStrandingListNamesEveryUnlinkedMemberForWhoeverCanChangeTheRules(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $linked = $this->member('tope@ire.events', 'Tope Bello', SeededRole::ReadOnly);
        $this->linkProvider($linked, 'g-tope');

        $body = $this->as($this->owner, 'GET', $this->path());

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['Bisi Adeyemi', 'Chidi Okoro'], Vec\map(
            Type\vec(Type\shape(['name' => Type\string()], true))->coerce($body['passwordOnly'] ?? null),
            static fn (array $member): string => $member['name'],
        ));
        self::assertArrayNotHasKey('passwordOnly', $this->as($linked, 'GET', $this->path()));
    }

    #[Test]
    public function anUnlinkedMemberStillSignsInWithAPasswordAndReadsButCannotChange(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->set(['providerOnly' => true]);

        $this->signIn('bisi@ire.events');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($bisi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/roles');
        self::assertSame(200, $this->statusCode());

        $this->as($bisi, 'PATCH', '/api/orgs/' . $this->organisation->getId()->toRfc4122(), ['name' => 'Bisi Events']);
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::OAuthOnlyUnlinked->type(), $this->last()['type'] ?? null);

        $standing = $this->standingOf($bisi);
        self::assertTrue($standing['readOnlyUntilLinked']);
    }

    #[Test]
    public function linkingAProviderLiftsReadOnlyOnTheNextRequest(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->set(['providerOnly' => true]);
        $this->linkProvider($bisi, 'g-bisi');

        $this->as($bisi, 'PATCH', '/api/orgs/' . $this->organisation->getId()->toRfc4122(), ['name' => 'Bisi Events']);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** Linking is itself a sign-in with the provider: the session it was linked from is not ended at its next refresh. */
    #[Test]
    public function thePasswordSessionAProviderIsLinkedFromCarriesOnPastItsRefreshes(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->set(['providerOnly' => true]);
        $session = $this->signIn('bisi@ire.events');
        $accessToken = Type\string()->coerce($session['accessToken'] ?? null);
        $proof = $this->bearing($accessToken, '/api/auth/proof', ['password' => self::PASSWORD]);

        $linked = $this->bearing($accessToken, '/api/auth/providers/google', ['proof' => $proof['proof'] ?? null, 'providerSignIn' => ['idToken' => $this->googleToken('g-bisi', 'bisi@gmail.com')]]);
        self::assertSame(201, $this->statusCode(), Json\encode($linked));

        $first = $this->refresh(Type\string()->coerce($session['refreshToken'] ?? null));
        self::assertSame(200, $this->statusCode(), Json\encode($first));
        $second = $this->refresh(Type\string()->coerce($first['refreshToken'] ?? null));
        self::assertSame(200, $this->statusCode(), Json\encode($second));
    }

    #[Test]
    public function theLastProviderCannotBeUnlinkedWhileTheRuleIsOn(): void
    {
        $this->set(['providerOnly' => true]);
        $proof = $this->as($this->owner, 'POST', '/api/auth/proof', ['password' => self::PASSWORD]);

        $body = $this->as($this->owner, 'POST', '/api/auth/providers/google/unlink', ['proof' => $proof['proof'] ?? null]);

        self::assertSame(409, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::ProviderKeptByRule->type(), $body['type'] ?? null);
        self::assertSame(['Ìrè Events', 'google'], [$body['organisation'] ?? null, $body['provider'] ?? null]);
    }

    #[Test]
    public function aSessionIdleLongerThanTheLimitIsRefusedByTheServer(): void
    {
        $this->set(['inactivityTimeoutDays' => 7]);
        $refreshToken = $this->signedInToken('folake@ire.events');

        self::mockTime('+8 days');
        $body = $this->refresh($refreshToken);

        self::assertSame(401, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::SessionTimedOut->type(), $body['type'] ?? null);
        self::assertSame(['Ìrè Events', 7, 'folake@ire.events'], [$body['organisation'] ?? null, $body['days'] ?? null, $body['email'] ?? null]);

        $this->refresh($refreshToken);
        self::assertSame(ErrorCode::InvalidRefreshToken->type(), $this->last()['type'] ?? null, 'the session ended, not only the request');
    }

    #[Test]
    public function aSessionUsedWithinTheLimitCarriesOn(): void
    {
        $this->set(['inactivityTimeoutDays' => 7]);
        $refreshToken = $this->signedInToken('folake@ire.events');

        self::mockTime('+6 days');
        $this->refresh($refreshToken);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aLimitSetLaterAppliesToSessionsAlreadyOpen(): void
    {
        $refreshToken = $this->signedInToken('folake@ire.events');
        $this->set(['inactivityTimeoutDays' => 7]);

        self::mockTime('+8 days');
        $this->refresh($refreshToken);

        self::assertSame(ErrorCode::SessionTimedOut->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function theShortestLimitAcrossOrganisationsAppliesAndIsNamed(): void
    {
        $this->set(['inactivityTimeoutDays' => 30]);
        $other = $this->account('ada@lumen.studio', 'Ada Okoye');
        $lumen = self::service(OrganisationFounder::class)->found($other, 'Studio Lumen', 'GB', 'Europe/London');
        self::em()->flush();
        $this->as($other, 'PATCH', '/api/orgs/' . $lumen->getId()->toRfc4122() . '/sign-in-rules', ['inactivityTimeoutDays' => 7]);
        $this->join($this->owner, $lumen, SeededRole::Coordinator);

        $limit = Type\shape(['organisation' => Type\string(), 'days' => Type\int()], true)->coerce($this->as($this->owner, 'GET', $this->path())['inactivityLimit'] ?? null);
        self::assertSame(['Studio Lumen', 7], [$limit['organisation'], $limit['days']]);

        $refreshToken = $this->signedInToken('folake@ire.events');
        self::mockTime('+8 days');
        $body = $this->refresh($refreshToken);

        self::assertSame(ErrorCode::SessionTimedOut->type(), $body['type'] ?? null);
        self::assertSame('Studio Lumen', $body['organisation'] ?? null);
    }

    #[Test]
    public function requiredTwoFactorWithholdsAdministrationAndNothingElse(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['administratorsNeedTwoFactor' => true]);

        $this->as($bisi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/roles');
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::OrganisationTwoFactorRequired->type(), $this->last()['type'] ?? null);
        self::assertSame('members.read', $this->last()['permission'] ?? null);

        $held = $this->as($bisi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/permissions');
        self::assertSame(
            ['members.read', 'members.manage', 'billing.read', 'organisation.manage'],
            $held['withheldUntilTwoFactor'] ?? null,
        );
        self::assertSame(
            Vec\filter(SeededRole::Administrator->defaults(), static fn (Permission $permission): bool => !$permission->isAdministrative()),
            Vec\map(Type\vec(Type\string())->coerce($held['permissions']), Permission::from(...)),
        );
    }

    #[Test]
    public function aMemberWithNoAdministrativePermissionIsUntouchedByRequiredTwoFactor(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $before = $this->as($chidi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/permissions');
        $this->turnOnTwoFactor($this->owner);
        $this->set(['administratorsNeedTwoFactor' => true]);

        self::assertSame($before, $this->as($chidi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/permissions'));
        self::assertSame([], $before['withheldUntilTwoFactor']);
    }

    #[Test]
    public function settingUpTwoFactorRestoresAdministrationOnTheNextRequest(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->turnOnTwoFactor($this->owner);
        $this->set(['administratorsNeedTwoFactor' => true]);
        $this->turnOnTwoFactor($bisi);

        $this->as($bisi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/roles');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function requiringTwoFactorOfAdministratorsIsRefusedToSomebodyWithoutItAndChangesNothing(): void
    {
        self::assertFalse($this->as($this->owner, 'GET', $this->path())['ownTwoFactor'] ?? null);

        $body = $this->set(['administratorsNeedTwoFactor' => true, 'inactivityTimeoutDays' => 30]);

        self::assertSame(409, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::TwoFactorOff->type(), $body['type'] ?? null);
        $rules = $this->as($this->owner, 'GET', $this->path());
        self::assertSame([false, null, []], [$rules['administratorsNeedTwoFactor'] ?? null, $rules['inactivityTimeoutDays'] ?? null, $rules['changes'] ?? null]);
        self::assertNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'sign_in_rules.changed']));
        self::assertSame([], $this->mails());
    }

    #[Test]
    public function requiringTwoFactorOfAdministratorsGoesThroughOnceTheSaverHasIt(): void
    {
        $this->turnOnTwoFactor($this->owner);
        self::assertTrue($this->as($this->owner, 'GET', $this->path())['ownTwoFactor'] ?? null);

        $body = $this->set(['administratorsNeedTwoFactor' => true]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertTrue($body['administratorsNeedTwoFactor'] ?? null);
    }

    #[Test]
    public function everyOtherRuleIsSavedBySomebodyWithoutTwoFactor(): void
    {
        $body = $this->set(['providerOnly' => true, 'inactivityTimeoutDays' => 7, 'administratorsNeedTwoFactor' => false]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame([true, 7], [$body['providerOnly'] ?? null, $body['inactivityTimeoutDays'] ?? null]);
    }

    #[Test]
    public function requiringGoogleOrAppleIsRefusedToSomebodyWithNeitherLinkedAndChangesNothing(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->unlink($this->owner);
        self::assertFalse($this->as($this->owner, 'GET', $this->path())['ownProvider'] ?? null);

        $body = $this->set(['providerOnly' => true, 'inactivityTimeoutDays' => 7]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OAuthOnlyUnlinked->type(), $body['type'] ?? null);
        $rules = $this->as($this->owner, 'GET', $this->path());
        self::assertSame([false, null, []], [$rules['providerOnly'] ?? null, $rules['inactivityTimeoutDays'] ?? null, $rules['changes'] ?? null]);
        self::assertNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'sign_in_rules.changed']));
        self::assertSame([], $this->mails());

        $body = $this->set(['inactivityTimeoutDays' => 7]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame([false, 7], [$body['providerOnly'] ?? null, $body['inactivityTimeoutDays'] ?? null]);
    }

    #[Test]
    public function requiringGoogleOrAppleGoesThroughOnceTheSaverHasOneLinked(): void
    {
        $this->unlink($this->owner);
        $this->linkProvider($this->owner, 'g-folake-again');
        self::assertTrue($this->as($this->owner, 'GET', $this->path())['ownProvider'] ?? null);

        $body = $this->set(['providerOnly' => true]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertTrue($body['providerOnly'] ?? null);
    }

    #[Test]
    public function theStrandingListNeverNamesTheMemberReadingIt(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->unlink($this->owner);

        $body = $this->as($this->owner, 'GET', $this->path());

        self::assertSame(['Bisi Adeyemi'], Vec\map(
            Type\vec(Type\shape(['name' => Type\string()], true))->coerce($body['passwordOnly'] ?? null),
            static fn (array $member): string => $member['name'],
        ));
    }

    #[Test]
    public function anUnlinkedOwnerStillCannotTurnTheRuleOffUntilTheyLink(): void
    {
        $this->set(['providerOnly' => true]);
        $this->unlink($this->owner);

        $body = $this->set(['providerOnly' => false]);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OAuthOnlyUnlinked->type(), $body['type'] ?? null);
        self::assertTrue($this->as($this->owner, 'GET', $this->path())['providerOnly'] ?? null);
    }

    #[Test]
    public function aChangeIsRecordedWithWhoAndWhenAndEveryMemberIsEmailed(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $body = $this->set(['providerOnly' => true, 'inactivityTimeoutDays' => 30]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['providerOnly', 'inactivityTimeoutDays'], Vec\map(Type\vec(Type\shape(['rule' => Type\string()], true))->coerce($body['changes']), static fn (array $change): string => $change['rule']));
        $change = Type\shape(['by' => Type\shape(['name' => Type\string(), 'role' => Type\shape(['seededAs' => Type\string()], true)], true), 'now' => Type\mixed(), 'was' => Type\mixed()], true)->coerce(Type\vec(Type\mixed())->coerce($body['changes'])[1]);
        self::assertSame(['Folake Adeyemi', 'owner', 30, null], [$change['by']['name'], $change['by']['role']['seededAs'], $change['now'], $change['was']]);

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'sign_in_rules.changed']);
        self::assertSame($this->owner->getId()->toRfc4122(), $entry?->getActorId()?->toRfc4122());

        $mails = $this->mails();
        self::assertSame(['bisi@ire.events', 'chidi@ire.events', 'folake@ire.events'], Vec\sort(Vec\map($mails, static fn (Email $mail): string => $mail->getTo()[0]->getAddress())));
        $toBisi = Iter\first(Vec\filter($mails, static fn (Email $mail): bool => 'bisi@ire.events' === $mail->getTo()[0]->getAddress()));
        self::assertStringContainsString('until you link Google or Apple. Your password still signs you in.', (string) $toBisi?->getTextBody());
        self::assertStringNotContainsString('Nobody is signed out', (string) $toBisi?->getTextBody());
        self::assertStringNotContainsString('Passwords stop working', (string) $toBisi?->getTextBody());
        $toFolake = Iter\first(Vec\filter($mails, static fn (Email $mail): bool => 'folake@ire.events' === $mail->getTo()[0]->getAddress()));
        self::assertStringNotContainsString('until you link Google or Apple', (string) $toFolake?->getTextBody());
    }

    #[Test]
    public function savingTheRulesAsTheyAreRecordsAndSendsNothing(): void
    {
        $this->set(['providerOnly' => false, 'inactivityTimeoutDays' => null]);

        self::assertSame([], $this->last()['changes']);
        self::assertSame([], $this->mails());
    }

    #[Test]
    public function onlyTheOfferedLengthsAreAccepted(): void
    {
        $this->set(['inactivityTimeoutDays' => 3]);

        self::assertSame(422, $this->statusCode());
    }

    /** @return iterable<string, array{array<string, mixed>, string}> */
    public static function rulesOfAnotherJsonType(): iterable
    {
        yield 'a numeric string for the timeout' => [['inactivityTimeoutDays' => '30'], 'inactivityTimeoutDays'];
        yield '1 for Google or Apple only' => [['providerOnly' => 1], 'providerOnly'];
        yield '0 for Google or Apple only' => [['providerOnly' => 0], 'providerOnly'];
        yield '"true" for two-factor for everyone' => [['everyoneNeedsTwoFactor' => 'true'], 'everyoneNeedsTwoFactor'];
        yield '"false" for two-factor for administrators' => [['administratorsNeedTwoFactor' => 'false'], 'administratorsNeedTwoFactor'];
        yield '"30.0" for the timeout' => [['inactivityTimeoutDays' => '30.0'], 'inactivityTimeoutDays'];
        yield 'true for the timeout' => [['inactivityTimeoutDays' => true], 'inactivityTimeoutDays'];
        yield 'a list for the timeout' => [['inactivityTimeoutDays' => [30]], 'inactivityTimeoutDays'];
        yield 'an object for the timeout' => [['inactivityTimeoutDays' => ['days' => 30]], 'inactivityTimeoutDays'];
        yield '1.0 for Google or Apple only' => [['providerOnly' => 1.0], 'providerOnly'];
    }

    /** @return iterable<string, array{string, int}> */
    public static function wholeTimeoutsWrittenAsFloats(): iterable
    {
        yield '30.0' => ['30.0', 30];
        yield '7.0' => ['7.0', 7];
        yield '3e1' => ['3e1', 30];
        yield '3.0E1' => ['3.0E1', 30];
        yield '30.0000000000000001, a fraction finer than a double holds' => ['30.0000000000000001', 30];
    }

    /** JSON has one number type, so 30.0 is 30 (sc-10158). */
    #[Test]
    #[DataProvider('wholeTimeoutsWrittenAsFloats')]
    public function aWholeTimeoutWrittenAsAFloatIsSavedAsTheWholeNumber(string $sent, int $days): void
    {
        $body = $this->setRaw('{"inactivityTimeoutDays":' . $sent . '}');

        self::assertSame(200, $this->statusCode());
        self::assertSame($days, $body['inactivityTimeoutDays'] ?? null);
        self::assertSame($days, $this->as($this->owner, 'GET', $this->path())['inactivityTimeoutDays'] ?? null);
    }

    /** @return iterable<string, array{string}> */
    public static function timeoutsThatAreNotWholeNumbers(): iterable
    {
        yield '30.5' => ['30.5'];
        yield '7.25' => ['7.25'];
        yield '30.00000000000001' => ['30.00000000000001'];
        yield '1e20, past the integer range' => ['1e20'];
        yield '12345678901234567890, past the integer range' => ['12345678901234567890'];
    }

    #[Test]
    #[DataProvider('timeoutsThatAreNotWholeNumbers')]
    public function aTimeoutThatIsNotAnIntegerIsRefusedRatherThanRoundedOrWrapped(string $sent): void
    {
        $body = $this->setRaw('{"inactivityTimeoutDays":' . $sent . '}');

        self::assertSame(422, $this->statusCode());
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type'] ?? null);
        self::assertSame([['propertyPath' => 'inactivityTimeoutDays', 'message' => 'This field cannot take that value. Check it and try again.', 'code' => 'invalid_shape']], $body['violations'] ?? null);
        self::assertNull($this->as($this->owner, 'GET', $this->path())['inactivityTimeoutDays'] ?? null);
    }

    #[Test]
    public function aWholeTimeoutWrittenAsAFloatThatIsNotOfferedIsRefusedAsTheIntegerIs(): void
    {
        $asInteger = $this->setRaw('{"inactivityTimeoutDays":14}');
        $asFloat = $this->setRaw('{"inactivityTimeoutDays":14.0}');

        self::assertSame(422, $this->statusCode());
        self::assertSame($asInteger['violations'] ?? null, $asFloat['violations'] ?? null);
        self::assertSame('choice', $asFloat['violations'][0]['code'] ?? null);
        self::assertSame('Choose 7 days, 30 days or no limit.', $asFloat['violations'][0]['message'] ?? null);
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function requestLanguages(): iterable
    {
        yield 'en' => ['', 'en', 'en'];
        yield 'es' => ['', 'es', 'es'];
        yield 'fr' => ['', 'fr', 'fr'];
        yield 'pt' => ['', 'pt', 'pt'];
        yield 'pt-BR reads as pt' => ['', 'pt-BR', 'pt'];
        yield 'an unknown language reads as English' => ['', 'xx', 'en'];
        yield 'the parameter outranks the header' => ['?locale=fr', 'en', 'fr'];
    }

    /** One response, one language: each refusal's sentences come from the catalogue its title does (sc-10594). */
    #[Test]
    #[DataProvider('requestLanguages')]
    public function eachRefusalIsWrittenInTheLanguageTheRequestAsks(string $query, string $header, string $locale): void
    {
        $translator = self::service(TranslatorInterface::class);
        $catalogued = static fn (string $key, string $domain = 'messages'): string => $translator->trans($key, [], $domain, $locale);

        $choice = $this->setIn($query, $header, ['inactivityTimeoutDays' => 14]);
        self::assertSame(422, $this->statusCode());
        self::assertSame($catalogued('validation_failed', ErrorCode::DOMAIN), $choice['title'] ?? null);
        self::assertSame($catalogued('sign_in_rules.inactivity_choice'), $choice['detail'] ?? null);
        self::assertSame([['propertyPath' => 'inactivityTimeoutDays', 'message' => $catalogued('sign_in_rules.inactivity_choice'), 'code' => 'choice']], $choice['violations'] ?? null);

        foreach ([['administratorsNeedTwoFactor' => true], ['everyoneNeedsTwoFactor' => true]] as $rules) {
            $twoFactor = $this->setIn($query, $header, $rules);
            self::assertSame(409, $this->statusCode());
            self::assertSame($catalogued('two_factor_off', ErrorCode::DOMAIN), $twoFactor['title'] ?? null);
            self::assertSame($catalogued('sign_in_rules.two_factor_off'), $twoFactor['detail'] ?? null);
        }

        $this->unlink($this->owner);
        $unlinked = $this->setIn($query, $header, ['providerOnly' => true]);
        self::assertSame(403, $this->statusCode());
        self::assertSame($catalogued('oauth_only_unlinked', ErrorCode::DOMAIN), $unlinked['title'] ?? null);
        self::assertSame($catalogued('sign_in_rules.provider_unlinked'), $unlinked['detail'] ?? null);

        $rules = $this->as($this->owner, 'GET', $this->path());
        self::assertSame([false, null, false, false, null, []], [$rules['providerOnly'] ?? null, $rules['inactivityTimeoutDays'] ?? null, $rules['administratorsNeedTwoFactor'] ?? null, $rules['everyoneNeedsTwoFactor'] ?? null, $rules['changedAt'] ?? null, $rules['changes'] ?? null]);
    }

    #[Test]
    public function eachRefusalReadsInEnglish(): void
    {
        $this->set(['inactivityTimeoutDays' => 14]);
        self::assertSame(['Choose 7 days, 30 days or no limit.', 'Choose 7 days, 30 days or no limit.'], [$this->last()['detail'] ?? null, $this->last()['violations'][0]['message'] ?? null]);

        $this->set(['everyoneNeedsTwoFactor' => true]);
        self::assertSame('Turn on two-factor for yourself before requiring it.', $this->last()['detail'] ?? null);

        $this->unlink($this->owner);
        $this->set(['providerOnly' => true]);
        self::assertSame('Link Google or Apple for yourself before requiring it.', $this->last()['detail'] ?? null);
    }

    /** @param array<string, mixed> $rules */
    #[Test]
    #[DataProvider('rulesOfAnotherJsonType')]
    public function aRuleOfAnotherJsonTypeIsRefusedAndChangesNothing(array $rules, string $path): void
    {
        $body = $this->set($rules);

        self::assertSame(422, $this->statusCode());
        self::assertSame([$path, 'invalid_shape'], [$body['violations'][0]['propertyPath'] ?? null, $body['violations'][0]['code'] ?? null]);
        $saved = $this->as($this->owner, 'GET', $this->path());
        self::assertSame([false, null], [$saved['providerOnly'] ?? null, $saved['inactivityTimeoutDays'] ?? null]);
    }

    #[Test]
    public function changingTheRulesNeedsOrganisationManage(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->as($chidi, 'PATCH', $this->path(), ['providerOnly' => true]);
        self::assertSame(403, $this->statusCode());

        $this->as($chidi, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), 'every member reads the rules in force');
    }

    /** Regression: an organisation with no rules set signs in, refreshes and changes as before. */
    #[Test]
    public function anOrganisationWithNoRulesBehavesAsBefore(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $refreshToken = $this->signedInToken('bisi@ire.events');

        self::mockTime('+29 days');
        $this->refresh($refreshToken);
        self::assertSame(200, $this->statusCode());

        $this->as($bisi, 'PATCH', '/api/orgs/' . $this->organisation->getId()->toRfc4122(), ['name' => 'Bisi Events']);
        self::assertSame(200, $this->statusCode());
        self::assertSame([], $this->standingOf($bisi)['withheldUntilTwoFactor']);
    }

    /** Regression: one organisation's rules leave the member's other organisations as they were. */
    #[Test]
    public function aMembersOtherOrganisationsAreUntouched(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $own = self::service(OrganisationFounder::class)->found($this->fresh($bisi), 'Bisi Studio', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->turnOnTwoFactor($this->owner);
        $this->set(['providerOnly' => true, 'administratorsNeedTwoFactor' => true]);

        $this->as($bisi, 'PATCH', '/api/orgs/' . $own->getId()->toRfc4122(), ['name' => 'Bisi Studio Ltd']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($bisi, 'GET', '/api/orgs/' . $own->getId()->toRfc4122() . '/roles');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aCompletedResetSetsThePasswordButIsRefusedLikeASignInUnderTheRule(): void
    {
        $this->set(['providerOnly' => true]);

        $this->forgot('folake@ire.events');
        self::assertSame([202, []], [$this->statusCode(), $this->last()], 'the request answers as for any address');
        $body = $this->reset($this->linkTo('folake@ire.events'));

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame(ErrorCode::OAuthOnly->type(), $body['type'] ?? null);
        self::assertSame(['Ìrè Events', ['google']], [$body['organisation'] ?? null, $body['providers'] ?? null]);
        self::assertArrayNotHasKey('accessToken', $body, 'nobody is signed in');
        self::assertTrue(self::service(PasswordResolver::class)->verify($this->fresh($this->owner), self::NEW_PASSWORD), 'the password is set');
    }

    #[Test]
    public function anUnlinkedMembersResetStillSignsThemIn(): void
    {
        $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->set(['providerOnly' => true]);

        $this->forgot('bisi@ire.events');
        $body = $this->reset($this->linkTo('bisi@ire.events'));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['accessToken'] ?? null);
    }

    #[Test]
    public function aResetOutsideTheRulesOrganisationSignsInAsBefore(): void
    {
        $this->set(['providerOnly' => true]);
        $ada = $this->account('ada@lumen.studio', 'Ada Okoye');
        $this->linkProvider($ada, 'g-ada');

        $this->forgot('ada@lumen.studio');
        $body = $this->reset($this->linkTo('ada@lumen.studio'));

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['accessToken'] ?? null);
    }

    #[Test]
    public function aPasswordSessionOpenedBeforeTheRuleEndsAtItsNextRefresh(): void
    {
        $refreshToken = $this->signedInToken('folake@ire.events');
        $this->set(['providerOnly' => true]);

        $body = $this->refresh($refreshToken);

        self::assertSame(403, $this->statusCode(), Json\encode($body));
        self::assertSame([ErrorCode::OAuthOnly->type(), 'Ìrè Events'], [$body['type'] ?? null, $body['organisation'] ?? null]);
        $this->refresh($refreshToken);
        self::assertSame(ErrorCode::InvalidRefreshToken->type(), $this->last()['type'] ?? null, 'the session ended, not only the request');
    }

    #[Test]
    public function aSessionOpenedWithGoogleCarriesOnUnderTheRule(): void
    {
        $tokens = self::service(TokenIssuer::class)->issueFor($this->fresh($this->owner), null, IdentityProvider::Google);
        self::em()->flush();
        $this->set(['providerOnly' => true]);

        $this->refresh($tokens->refreshToken);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aReadOnlyMemberIsOfferedNoChange(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->set(['providerOnly' => true]);

        $offered = Type\vec(Type\string())->coerce($this->as($bisi, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/permissions')['permissions'] ?? null);

        self::assertContains('events.read', $offered);
        self::assertSame([], Vec\filter($offered, static fn (string $permission): bool => Str\ends_with($permission, '.manage')));
    }

    #[Test]
    public function theInactivityLineCountsItsDays(): void
    {
        $mailer = self::service(UserMailer::class);

        self::assertStringContainsString('for 1 day is', $mailer->line('signInRules.rule.inactivity', 'en', ['days' => 1]));
        self::assertStringContainsString('for 7 days is', $mailer->line('signInRules.rule.inactivity', 'en', ['days' => 7]));
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

    /** @return array<string, mixed> */
    private function setRaw(string $json): array
    {
        $this->client->request('PATCH', $this->path(), server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh($this->owner)),
        ], content: $json);

        return $this->last();
    }

    /**
     * @param array<string, mixed> $rules
     *
     * @return array<string, mixed>
     */
    private function setIn(string $query, string $language, array $rules): array
    {
        $this->client->request('PATCH', $this->path() . $query, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT_LANGUAGE' => $language,
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh($this->owner)),
        ], content: Json\encode($rules));

        return $this->last();
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

    private function linkProvider(User $user, string $subject): void
    {
        self::em()->persist(new ProviderIdentity($this->fresh($user), IdentityProvider::Google, $subject, null));
        self::em()->flush();
    }

    private function unlink(User $user): void
    {
        foreach (self::em()->getRepository(ProviderIdentity::class)->findBy(['user' => $user->getId()]) as $identity) {
            self::em()->remove($identity);
        }

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

    /** @return array{readOnlyUntilLinked: bool, withheldUntilTwoFactor: list<string>} in this test's organisation */
    private function standingOf(User $user): array
    {
        $organisations = Type\vec(Type\shape([
            'id' => Type\string(),
            'readOnlyUntilLinked' => Type\bool(),
            'withheldUntilTwoFactor' => Type\vec(Type\string()),
        ], true))->coerce($this->as($user, 'GET', '/api/orgs')['organisations']);
        $mine = Iter\first(Vec\filter($organisations, fn (array $organisation): bool => $organisation['id'] === $this->organisation->getId()->toRfc4122())) ?? self::fail('not a member');

        return ['readOnlyUntilLinked' => $mine['readOnlyUntilLinked'], 'withheldUntilTwoFactor' => $mine['withheldUntilTwoFactor']];
    }

    /** @return array<string, mixed> */
    private function signIn(string $address): array
    {
        $this->client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['email' => $address, 'password' => self::PASSWORD]));

        return $this->last();
    }

    private function signedInToken(string $address): string
    {
        $body = $this->signIn($address);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['refreshToken'] ?? null);
    }

    /** @return array<string, mixed> */
    private function refresh(#[SensitiveParameter] string $refreshToken): array
    {
        $this->client->request('POST', '/api/auth/refresh', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['refreshToken' => $refreshToken]));

        return $this->last();
    }

    private function forgot(string $address): void
    {
        $this->client->request('POST', '/api/auth/password/forgot', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['email' => $address]));
    }

    private function linkTo(string $address): string
    {
        $mail = Iter\last(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && $address === $message->getTo()[0]->getAddress(),
        ));

        return Regex\first_match((string) Type\instance_of(Email::class)->coerce($mail)->getTextBody(), '/reset-password\?token=([0-9a-f]+)/')[1] ?? '';
    }

    /** @return array<string, mixed> */
    private function reset(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/auth/password/reset', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => $token, 'password' => self::NEW_PASSWORD]));

        return $this->last();
    }

    /** @return list<Email> */
    private function mails(): array
    {
        return Vec\map(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), 'sign-in rules'),
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
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh($user)),
        ], content: null === $body ? null : Json\encode([] === $body ? new stdClass() : $body));

        return $this->last();
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function bearing(#[SensitiveParameter] string $accessToken, string $path, array $body): array
    {
        $this->client->request('POST', $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $accessToken,
        ], content: Json\encode($body));

        return $this->last();
    }

    private function googleToken(string $subject, string $email): string
    {
        $configured = static fn (string $name): string => Str\trim(Str\split(Type\string()->coerce($_SERVER[$name] ?? $_ENV[$name] ?? ''), ',')[0] ?? '');

        return self::service(TestSigningKeys::class)->sign([
            'iss' => $configured('OAUTH_GOOGLE_ISSUERS'),
            'aud' => $configured('OAUTH_GOOGLE_CLIENT_IDS'),
            'iat' => new Clock()->now()->modify('-1 minute'),
            'exp' => new Clock()->now()->modify('+1 hour'),
            'sub' => $subject,
            'email' => $email,
            'email_verified' => true,
        ]);
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
