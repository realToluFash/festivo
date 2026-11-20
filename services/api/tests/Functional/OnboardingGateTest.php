<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Onboarding\OnboardingGate;
use App\Domain\User\UserRegistrar;
use App\Domain\User\Verification\RecordingTextMessageSender;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Repository\MembershipRepository;
use App\Repository\PhoneNumberRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Symfony\Component\Routing\RouterInterface;

final class OnboardingGateTest extends ApiTestCase
{
    use InvitesPeople;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function anUnverifiedAccountIsSentToVerification(): void
    {
        $this->signIn($this->registered('unverified@example.com'));

        $body = $this->call('GET', '/api/orgs');

        self::assertSame(403, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::AccountUnverified->type(), $body['type']);
    }

    #[Test]
    public function aVerifiedButIncompleteAccountIsSentToTheDetailsScreen(): void
    {
        $user = $this->registered('incomplete@example.com');
        $this->verify($user);
        $this->signIn($user);

        $body = $this->call('GET', '/api/orgs');

        self::assertSame(403, $this->client->getResponse()->getStatusCode());
        self::assertSame(ErrorCode::ProfileIncomplete->type(), $body['type']);
    }

    /** Neither verified nor complete: verification is asked first. */
    #[Test]
    public function verificationComesFirstWhenBothApply(): void
    {
        $this->signIn($this->registered('both@example.com'));

        self::assertSame(ErrorCode::AccountUnverified->type(), $this->call('GET', '/api/auth/sessions')['type']);
    }

    /** One title for the gate (RFC 9457 §3.1.3), and a detail that names what is unverified. */
    #[Test]
    public function theGatesDetailNamesWhatIsUnverified(): void
    {
        $user = $this->registered('which@example.com');
        $this->signIn($user);
        $email = $this->call('GET', '/api/orgs');
        self::assertSame('Verify your account to carry on.', $email['title']);
        self::assertSame('Verify your email address to carry on.', $email['detail'], 'an unverified email, no phone');

        $phone = new PhoneNumber($user, '+2348035550142', isPrimary: true, countryCode: 'NG');
        self::em()->persist($phone);
        self::em()->flush();
        $this->signIn($user);

        $both = $this->call('GET', '/api/orgs');
        self::assertSame('Verify your account to carry on.', $both['title']);
        self::assertSame('Verify your email address to carry on.', $both['detail'], 'both unverified: the email first');

        // Each request reboots the kernel, so the account is read afresh before its email is verified.
        $user = Type\instance_of(User::class)->coerce(self::em()->find(User::class, $user->getId()));
        $this->verify($user);
        $this->signIn($user);

        $onlyPhone = $this->call('GET', '/api/orgs');
        self::assertSame('Verify your account to carry on.', $onlyPhone['title']);
        self::assertSame('Verify your mobile number to carry on.', $onlyPhone['detail']);

        $this->client->setServerParameter('HTTP_ACCEPT_LANGUAGE', 'fr');
        self::assertSame('Vérifiez votre numéro de portable pour continuer.', $this->call('GET', '/api/orgs')['detail']);
    }

    #[Test]
    public function aMissingCountryIsOneViolationOnCountryAlone(): void
    {
        $user = $this->registered('nocountry@example.com');
        $this->verify($user);
        $this->signIn($user);

        $body = $this->call('PATCH', '/api/auth/complete-profile', ['name' => 'Person', 'organisationName' => 'Ire Events', 'timezone' => 'Africa/Lagos']);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(['countryCode'], \array_column(Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']), 'propertyPath'), 'currency is derived, so it is not a violation');
    }

    /** A route nobody exempted is behind the gate: adding an unprotected one takes a deliberate act. */
    #[Test]
    public function aRouteNotOnTheExemptListIsGatedByDefault(): void
    {
        $this->signIn($this->registered('default@example.com'));

        $this->call('GET', '/api/_access/organisations/018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f');

        self::assertSame(403, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function theExemptListNamesOnlyRoutesThatExist(): void
    {
        $routes = self::service(RouterInterface::class)->getRouteCollection();

        foreach (OnboardingGate::EXEMPT as $name) {
            self::assertNotNull($routes->get($name), "The exempt list names \"{$name}\", which is not a route.");
        }
    }

    /** @return iterable<string, array{string, string, array<string, mixed>|null}> */
    public static function exemptCalls(): iterable
    {
        yield 'me' => ['GET', '/api/auth/me', null];
        yield 'the resend cooldown' => ['GET', '/api/auth/verify/resend', null];
        yield 'a resend' => ['POST', '/api/auth/verify/resend', null];
        yield 'a code' => ['POST', '/api/auth/verify/email', ['code' => '000000']];
        yield 'the language' => ['PUT', '/api/auth/locale', ['locale' => 'fr']];
        yield 'the details screen' => ['PATCH', '/api/auth/complete-profile', ['name' => '']];
        yield 'setting a phone' => ['PUT', '/api/auth/phone', ['countryCode' => 'NG', 'number' => '']];
        yield 'a phone code' => ['POST', '/api/auth/verify/phone', ['code' => '000000']];
        yield 'the phone cooldown' => ['GET', '/api/auth/verify/phone/resend', null];
        yield 'a phone resend' => ['POST', '/api/auth/verify/phone/resend', null];
        yield 'invitations waiting' => ['GET', '/api/invitations', null];
        yield 'accepting one' => ['POST', '/api/invitations/018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f/accept', null];
        yield 'declining one' => ['POST', '/api/invitations/018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f/decline', null];
    }

    /** @param array<string, mixed>|null $body */
    #[Test]
    #[DataProvider('exemptCalls')]
    public function everyExemptEndpointAnswersAtBothStages(string $method, string $path, ?array $body): void
    {
        $unverified = $this->registered('exempt-unverified@example.com');
        $incomplete = $this->registered('exempt-incomplete@example.com');
        $this->verify($incomplete);

        foreach ([$unverified, $incomplete] as $user) {
            $this->signIn($user);
            $answer = $this->call($method, $path, $body);

            self::assertNotContains(
                $answer['type'] ?? null,
                [ErrorCode::AccountUnverified->type(), ErrorCode::ProfileIncomplete->type()],
                "{$method} {$path} was refused by the gate",
            );
        }
    }

    #[Test]
    public function anAccountStillOnboardingSavesItsLanguage(): void
    {
        $unverified = $this->registered('language-unverified@example.com');
        $incomplete = $this->registered('language-incomplete@example.com');
        $this->verify($incomplete);

        foreach ([$unverified, $incomplete] as $user) {
            $this->signIn($user);

            self::assertSame(['locale' => 'es'], $this->call('PUT', '/api/auth/locale', ['locale' => 'es']));
            self::assertSame(200, $this->client->getResponse()->getStatusCode());
            self::assertSame('es', $this->call('GET', '/api/auth/me')['locale']);

            $refused = $this->call('PUT', '/api/auth/locale', ['locale' => 'de']);
            self::assertSame(422, $this->client->getResponse()->getStatusCode());
            self::assertSame(ErrorCode::ValidationFailed->type(), $refused['type'], 'refused as for a complete account');
            self::assertSame('es', $this->call('GET', '/api/auth/me')['locale']);
        }
    }

    #[Test]
    public function logoutAndRefreshNeedNoGate(): void
    {
        self::service(UserRegistrar::class)->register('public@example.com', 'Public', self::PASSWORD);
        $this->client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'email' => 'public@example.com',
            'password' => self::PASSWORD,
        ]));
        $refresh = Type\shape(['refreshToken' => Type\string()], true)->coerce($this->decode())['refreshToken'];

        $this->client->request('POST', '/api/auth/refresh', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['refreshToken' => $refresh]));
        self::assertSame(200, $this->client->getResponse()->getStatusCode());

        $next = Type\shape(['refreshToken' => Type\string()], true)->coerce($this->decode())['refreshToken'];
        $this->client->request('POST', '/api/auth/logout', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['refreshToken' => $next]));
        self::assertLessThan(300, $this->client->getResponse()->getStatusCode());
    }

    /** Written as "the phone must be verified", this gate would lock out every Google account. */
    #[Test]
    public function anAccountWithNoPhonePassesOnItsEmailAlone(): void
    {
        $user = $this->registered('no-phone@example.com');
        self::onboard($user);
        self::assertNull($user->getPrimaryPhoneNumber());
        $this->signIn($user);

        $this->call('GET', '/api/orgs');

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function savingTheDetailsFoundsTheOrganisationAndOpensTheGate(): void
    {
        $user = $this->registered('founder@example.com');
        $this->verify($user);
        $this->signIn($user);
        self::assertTrue(Type\shape(['needsOrganisation' => Type\bool()], true)->coerce($this->call('GET', '/api/auth/me'))['needsOrganisation']);

        $body = $this->call('PATCH', '/api/auth/complete-profile', [
            'name' => '  Folake Adeyemi ',
            'organisationName' => 'Ìrè Events',
            'countryCode' => 'NG',
            'timezone' => 'Africa/Lagos',
        ]);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertFalse($body['verificationNeeded'], 'no phone, so nothing more to verify');
        $account = Type\shape(['name' => Type\string(), 'complete' => Type\bool(), 'needsOrganisation' => Type\bool()], true)
            ->coerce($body['account']);
        self::assertSame('Folake Adeyemi', $account['name']);
        self::assertTrue($account['complete']);
        self::assertFalse($account['needsOrganisation'], 'it has one now');

        $memberships = self::service(MembershipRepository::class)->findActiveFor($user);
        self::assertCount(1, $memberships);
        self::assertSame('Ìrè Events', $memberships[0]->getOrganisation()->getName());
        self::assertTrue($memberships[0]->getRole()->isOwner());

        $this->call('GET', '/api/orgs');
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), 'the gate is open');
    }

    #[Test]
    public function aBlankNameAndAMissingOrganisationAreRefusedTogetherAndNothingIsSaved(): void
    {
        $user = $this->registered('blank@example.com');
        $this->verify($user);
        $this->signIn($user);

        $body = $this->call('PATCH', '/api/auth/complete-profile', ['name' => '   ', 'organisationName' => ' ', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(
            ['name', 'organisationName'],
            \array_column(Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']), 'propertyPath'),
        );

        self::service(EntityManagerInterface::class)->clear();
        self::assertSame([], self::service(MembershipRepository::class)->findActiveFor($user));
    }

    /** An invited account joins the inviting organisation, so it is not asked for one. */
    #[Test]
    public function anInvitedAccountIsCompleteWithANameAndOneSave(): void
    {
        $invited = self::service(UserRegistrar::class)->registerFromInvitation(self::invitationTo('invited@example.com')[0], 'Invited', self::PASSWORD)->user;
        self::service(EntityManagerInterface::class)->flush();
        $this->signIn($invited);

        $body = $this->call('PATCH', '/api/auth/complete-profile', ['name' => 'Invited Person']);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertTrue(Type\shape(['complete' => Type\bool()], true)->coerce($body['account'])['complete']);
        self::assertSame([], self::service(MembershipRepository::class)->findActiveFor($invited));
    }

    /** "A few details" can't read /api/orgs behind the gate, so /me says where an invited person's number starts. */
    #[Test]
    public function theAccountSaysItsOrganisationsCountryBehindTheGate(): void
    {
        $invited = self::service(UserRegistrar::class)->registerFromInvitation(self::invitationTo('invited@example.com')[0], 'Invited', self::PASSWORD)->user;
        self::service(EntityManagerInterface::class)->flush();
        $this->signIn($invited);
        self::assertNull($this->call('GET', '/api/auth/me')['organisationCountry'], 'in no organisation yet');

        self::service(OrganisationFounder::class)->found($invited, 'Ìrè Events', 'GH', 'Africa/Accra');
        self::service(EntityManagerInterface::class)->flush();

        self::assertSame('GH', $this->call('GET', '/api/auth/me')['organisationCountry']);
    }

    #[Test]
    public function savingWithAPhoneTextsItAndTheGateWaitsForTheCode(): void
    {
        $this->client->disableReboot();
        $user = $this->registered('with-phone@example.com');
        $this->verify($user);
        $this->signIn($user);

        $body = $this->call('PATCH', '/api/auth/complete-profile', [
            'name' => 'Folake Adeyemi',
            'organisationName' => 'Ìrè Events',
            'countryCode' => 'NG',
            'timezone' => 'Africa/Lagos',
            'phoneCountryCode' => 'NG',
            'phoneNumber' => '0803 555 0142',
        ]);

        self::assertSame(200, $this->client->getResponse()->getStatusCode(), Json\encode($body));
        self::assertTrue($body['verificationNeeded']);
        self::assertSame('+2348035550142', $this->texts()[0]['to'] ?? null);
        self::assertSame(ErrorCode::AccountUnverified->type(), $this->call('GET', '/api/orgs')['type']);

        $this->call('POST', '/api/auth/verify/phone', ['code' => $this->lastCode()]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode());

        $this->call('GET', '/api/orgs');
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), 'verified and complete');
    }

    #[Test]
    public function aMistypedPhoneIsRefusedWithTheOtherFieldsAndNothingIsSaved(): void
    {
        $this->client->disableReboot();
        $user = $this->registered('mistyped@example.com');
        $this->verify($user);
        $this->signIn($user);

        $body = $this->call('PATCH', '/api/auth/complete-profile', [
            'name' => ' ',
            'organisationName' => 'Ìrè Events',
            'countryCode' => 'NG',
            'timezone' => 'Africa/Lagos',
            'phoneCountryCode' => 'NG',
            'phoneNumber' => '803 55',
        ]);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        $violations = Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']);
        self::assertSame(['name', 'phoneNumber'], \array_column($violations, 'propertyPath'));
        self::assertSame('That number looks too short for Nigeria. Check it and try again.', $violations[1]['message']);
        self::assertSame([], $this->texts());
        self::assertSame(0, self::service(PhoneNumberRepository::class)->count([]));
    }

    /** Saving with the field empty takes the phone away, and the verified gate rests on the email again. */
    #[Test]
    public function anEmptyPhoneFieldRemovesThePhone(): void
    {
        $user = $this->registered('removed@example.com');
        new PhoneNumber($user, '+2348035550142', true, 'NG');
        self::onboard($user);
        $this->signIn($user);
        self::assertSame(ErrorCode::AccountUnverified->type(), $this->call('GET', '/api/orgs')['type'], 'held by the unverified phone');

        $this->call('PATCH', '/api/auth/complete-profile', ['name' => 'Person', 'phoneCountryCode' => 'NG', 'phoneNumber' => '']);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertNull(self::service(PhoneNumberRepository::class)->findOneByNumber('+2348035550142'));
        $this->call('GET', '/api/orgs');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    /** The verified number keeps counting until its replacement is proved, so the gate stays open. */
    #[Test]
    public function aChangedPhoneWaitsForItsCodeAndTheGateStaysOpen(): void
    {
        $this->client->disableReboot();
        $user = $this->registered('changed@example.com');
        $phone = new PhoneNumber($user, '+2348035550142', true, 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        self::onboard($user);
        $this->signIn($user);

        $body = $this->call('PATCH', '/api/auth/complete-profile', ['name' => 'Person', 'phoneCountryCode' => 'GH', 'phoneNumber' => '024 412 3456']);

        self::assertTrue($body['verificationNeeded'], 'the new number is texted a code');
        self::assertSame('+233244123456', $this->texts()[0]['to'] ?? null);
        $this->call('GET', '/api/orgs');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function aVerifiedAlternativeIsPromotedAndTheGateStaysOpen(): void
    {
        $this->client->disableReboot();
        $user = $this->registered('alternative@example.com');
        $alternative = new PhoneNumber($user, '+2348035550142', false, 'NG');
        $alternative->setVerifiedAt(new DateTimeImmutable());
        self::onboard($user);
        $this->signIn($user);

        $body = $this->call('PATCH', '/api/auth/complete-profile', ['name' => 'Person', 'phoneCountryCode' => 'NG', 'phoneNumber' => '0803 555 0142']);

        self::assertFalse($body['verificationNeeded']);
        self::assertSame([], $this->texts());
        self::assertTrue(self::service(PhoneNumberRepository::class)->findOneByNumber('+2348035550142')?->isPrimary());
        $this->call('GET', '/api/orgs');
        self::assertSame(200, $this->client->getResponse()->getStatusCode());
    }

    /** @return list<array{to: string, body: string}> */
    private function texts(): array
    {
        return self::service(RecordingTextMessageSender::class)->sent;
    }

    private function lastCode(): string
    {
        $last = Iter\last($this->texts())['body'] ?? '';

        return Regex\first_match($last, '/(\d{6})/')[1] ?? '';
    }

    private function registered(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    private function verify(User $user): void
    {
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->flush();
    }

    private function signIn(User $user): void
    {
        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request(
            $method,
            $path,
            server: ['CONTENT_TYPE' => 'application/json'],
            content: null === $body ? null : Json\encode($body),
        );

        return $this->decode();
    }

    /** @return array<string, mixed> */
    private function decode(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }
}
