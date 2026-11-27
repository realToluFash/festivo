<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\EmailDomains\EmailDomains;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\OwnerClaims\ScriptedTxtRecordLookup;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\Organisation\SignInRules\BreakGlass;
use App\Domain\Organisation\SingleSignOn\ScriptedProviderDocuments;
use App\Domain\Organisation\SingleSignOn\SingleSignOnSettings;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\SeededRole;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Clock;

final class SingleSignOnSettingsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string OKTA_METADATA = 'https://ire-events.okta.com/app/exk1a2b3c4/sso/saml/metadata';
    private const string GOOGLE = 'https://accounts.google.com';

    protected function setUp(): void
    {
        parent::setUp();
        ScriptedTxtRecordLookup::forgetAll();
        ScriptedProviderDocuments::forgetAll();
    }

    #[Test]
    public function savingAnOpenIdConnectProviderReadsTheIssuerAndSwitchesNothingOn(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->publishGoogle();
        $this->signIn($owner);

        /** @mago-expect lint:no-literal-password */
        $page = $this->send('PUT', $this->path($organisation, 'provider'), [
            'protocol' => 'oidc',
            'name' => ' Google Workspace ',
            'issuer' => self::GOOGLE . '/',
            'clientId' => '48120-ire.apps.googleusercontent.com',
            'clientSecret' => 'gw-7Hq2xL9vR4mK8pT1',
        ]);

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['ire.events'], $page['domains']);
        self::assertSame([
            'protocol' => 'oidc',
            'name' => 'Google Workspace',
            'way' => 'url',
            'url' => null,
            'file' => null,
            'issuer' => self::GOOGLE,
            'clientId' => '48120-ire.apps.googleusercontent.com',
        ], $page['provider']);
        self::assertSame(['untested', false, false], [$page['test'], $page['on'], $page['required']]);
        self::assertStringNotContainsString('gw-7Hq2xL9vR4mK8pT1', Json\encode($page), 'the secret never comes back');
        self::assertStringEndsWith(Str\format('/api/sso/oidc/%s/callback', $organisation->getId()->toRfc4122()), Type\string()->coerce(Type\shape(['oidc' => Type\shape(['redirectUrl' => Type\string()])], true)->coerce($page['ours'])['oidc']['redirectUrl']));
        self::assertSame(['provider' => [null, 'Google Workspace'], 'protocol' => [null, 'oidc']], $this->audited(SingleSignOnSettings::SAVED, $organisation)->getChanges());
    }

    #[Test]
    public function savingASamlProviderReadsItsMetadataFromTheUrlOrTheFile(): void
    {
        [$owner, $organisation] = $this->proved();
        ScriptedProviderDocuments::publish(self::OKTA_METADATA, self::metadata());
        $this->signIn($owner);

        $page = $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'saml', 'name' => 'Okta', 'metadataUrl' => self::OKTA_METADATA]);
        self::assertResponseStatusCodeSame(200);
        self::assertSame(['saml', 'Okta', 'url', self::OKTA_METADATA], [$page['provider']['protocol'] ?? null, $page['provider']['name'] ?? null, $page['provider']['way'] ?? null, $page['provider']['url'] ?? null]);

        $page = $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'saml', 'name' => 'Okta', 'metadataXml' => self::metadata(), 'metadataFileName' => 'okta-metadata.xml']);
        self::assertResponseStatusCodeSame(200);
        self::assertSame(['file', 'okta-metadata.xml'], [$page['provider']['way'] ?? null, $page['provider']['file'] ?? null]);
    }

    #[Test]
    public function whatCannotBeReadIsRefusedOnItsField(): void
    {
        [$owner, $organisation] = $this->proved();
        ScriptedProviderDocuments::publish(self::OKTA_METADATA, '<html>Sign in to Okta</html>');
        $this->signIn($owner);

        $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'saml', 'name' => 'Okta', 'metadataUrl' => self::OKTA_METADATA]);
        self::assertResponseStatusCodeSame(422);
        self::assertSame([['metadata', 'sso_metadata_unreadable']], $this->violations());

        $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'saml', 'name' => 'Okta', 'metadataXml' => '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>' . self::metadata()]);
        self::assertSame([['metadata', 'sso_metadata_unreadable']], $this->violations(), 'a document type is never read');

        /** @mago-expect lint:no-literal-password */
        $body = $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'oidc', 'name' => 'Google', 'issuer' => 'https://accounts.google.com/bad', 'clientId' => 'id', 'clientSecret' => 'secret']);
        self::assertSame([['issuer', 'sso_discovery_failed']], $this->violations());
        self::assertStringContainsString('https://accounts.google.com/bad/.well-known/openid-configuration', Json\encode($body));

        $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'oidc', 'name' => Str\repeat('O', 41), 'issuer' => 'http://accounts.google.com', 'clientId' => ' ', 'clientSecret' => '']);
        self::assertSame([
            ['name', 'sso_name_long'],
            ['issuer', 'sso_issuer_shape'],
            ['clientId', 'sso_client_id_blank'],
            ['clientSecret', 'sso_client_secret_blank'],
        ], $this->violations());

        $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'saml', 'name' => '', 'metadataUrl' => 'http://ire-events.okta.com/metadata']);
        self::assertSame([['name', 'sso_name_blank'], ['metadata', 'sso_metadata_shape']], $this->violations());
        self::assertNull($this->send('GET', $this->path($organisation))['provider']);
    }

    #[Test]
    public function itSwitchesOnOnlyAfterATestWorked(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->saveGoogle($owner, $organisation);

        $refused = $this->send('POST', $this->path($organisation, 'on'));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::SsoUntested->type(), $refused['type']);

        $this->testFailed($organisation, $owner, 'This person is not assigned to the Soirely app.');
        self::assertSame(['failed', 'This person is not assigned to the Soirely app.'], [$this->page($owner, $organisation)['test'], $this->page($owner, $organisation)['testFailure']]);
        $this->send('POST', $this->path($organisation, 'on'));
        self::assertResponseStatusCodeSame(409);

        $this->testWorked($organisation, $owner);
        $page = $this->page($owner, $organisation);
        self::assertSame(['passed', 'folake@ire.events', 'Folake Adeyemi'], [$page['test'], $page['testedEmail'], $page['testedName']]);
        $on = $this->send('POST', $this->path($organisation, 'on'));
        self::assertResponseStatusCodeSame(200);
        self::assertTrue($on['on']);
        self::assertSame(['sso' => [false, true], 'provider' => [null, 'Google Workspace']], $this->audited(SingleSignOnSettings::SWITCHED_ON, $organisation)->getChanges());
    }

    #[Test]
    public function aChangedProviderLeavesTheOldOneSigningPeopleInUntilTheNewOneIsSwitchedOn(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->saveGoogle($owner, $organisation);
        $this->testWorked($organisation, $owner);
        $this->send('POST', $this->path($organisation, 'on'));
        $this->send('POST', $this->path($organisation, 'required'));
        ScriptedProviderDocuments::publish(self::OKTA_METADATA, self::metadata());

        $page = $this->send('PUT', $this->path($organisation, 'provider'), ['protocol' => 'saml', 'name' => 'Okta', 'metadataUrl' => self::OKTA_METADATA]);
        self::assertResponseStatusCodeSame(200);
        self::assertSame(['Okta', 'Google Workspace', false, true, 'untested'], [$page['provider']['name'] ?? null, $page['staying']['name'] ?? null, $page['on'], $page['required'], $page['test']]);
        self::assertSame(['provider' => ['Google Workspace', 'Okta'], 'protocol' => ['oidc', 'saml']], $this->audited(SingleSignOnSettings::CHANGED, $organisation)->getChanges());
        self::assertSame('Google Workspace', self::service(SingleSignOnSettings::class)->live($this->fresh($organisation))?->getName());

        $this->testWorked($organisation, $owner);
        $page = $this->send('POST', $this->path($organisation, 'on'));
        self::assertSame(['Okta', null, true, true], [$page['provider']['name'] ?? null, $page['staying'], $page['on'], $page['required']]);
    }

    #[Test]
    public function requiredSignOnHoldsTheProviderOnUntilItIsTurnedOff(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->saveGoogle($owner, $organisation);

        $this->send('POST', $this->path($organisation, 'required'));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::SsoNotOn->type(), $this->problem()['type']);

        $this->testWorked($organisation, $owner);
        $this->send('POST', $this->path($organisation, 'on'));
        self::assertTrue($this->send('POST', $this->path($organisation, 'required'))['required']);
        self::assertSame(['required' => [false, true]], $this->audited(SingleSignOnSettings::REQUIRED_ON, $organisation)->getChanges());

        $this->send('DELETE', $this->path($organisation, 'provider'));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::SsoRequiredOn->type(), $this->problem()['type']);
        $this->send('DELETE', $this->path($organisation, 'on'));
        self::assertResponseStatusCodeSame(409);

        self::assertFalse($this->send('DELETE', $this->path($organisation, 'required'))['required']);
        $page = $this->send('DELETE', $this->path($organisation, 'provider'));
        self::assertResponseStatusCodeSame(200);
        self::assertSame([null, null, false], [$page['provider'], $page['staying'], $page['on']]);
        self::assertSame(['provider' => ['Google Workspace', null]], $this->audited(SingleSignOnSettings::REMOVED, $organisation)->getChanges());
    }

    #[Test]
    public function requiredSignOnTurnsEveryOtherWayInAwayForTheDomainButNotForAnOwner(): void
    {
        // The scripted provider's signing key lives in the container.
        $this->client->disableReboot();
        [$owner, $organisation] = $this->proved();
        $this->join($organisation, $this->member('julien@ire.events', 'Julien'), SeededRole::Admin);
        $this->member('stranger@ire.events', 'No Membership');
        $this->join($organisation, $this->member('tobi@elsewhere.example', 'Tobi'), SeededRole::Owner);
        $this->join($organisation, $this->member('kemi@elsewhere.example', 'Kemi'), SeededRole::Admin);
        $this->saveGoogle($owner, $organisation);
        $this->testWorked($organisation, $owner);
        $this->send('POST', $this->path($organisation, 'on'));
        self::assertSame(200, $this->passwordSignIn('julien@ire.events'), 'on but not required');

        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, 'required'));

        foreach (['julien@ire.events', 'stranger@ire.events'] as $address) {
            self::assertSame(403, $this->passwordSignIn($address), $address);
            $problem = Type\shape(['type' => Type\string(), 'detail' => Type\string(), 'organisation' => Type\string(), 'provider' => Type\string()], true)->coerce($this->problem());
            self::assertSame(ErrorCode::SsoSignInRequired->type(), $problem['type']);
            self::assertSame(['Ìrè Events', 'Google Workspace'], [$problem['organisation'], $problem['provider']]);
            self::assertSame('Ìrè Events signs you in through Google Workspace.', $problem['detail']);
        }

        self::assertSame(200, $this->passwordSignIn('kemi@elsewhere.example'), 'an address elsewhere is untouched');
        self::assertNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => BreakGlass::USED]), 'nobody has gone around anything yet');

        self::assertSame(200, $this->passwordSignIn('folake@ire.events'), 'an Owner keeps their own sign-in');
        self::assertSame(['signedInWith' => [null, 'password']], $this->audited(BreakGlass::USED, $organisation)->getChanges());
        self::assertSame(
            [['sign_in_rules.notice', 1]],
            Vec\map(
                self::service(Connection::class)->fetchAllAssociative("SELECT type, jsonb_array_length((audience::jsonb) -> 'only') AS told FROM scheduled_notifications WHERE payload::jsonb ->> 'email' = 'break_glass'"),
                static fn (array $row): array => [Type\string()->coerce($row['type']), Type\int()->coerce($row['told'])],
            ),
            'the other Owner is told, not the one who signed in',
        );

        foreach (['julien@ire.events', 'newcomer@ire.events'] as $address) {
            $this->send('POST', '/api/auth/oauth/google', ['idToken' => $this->googleToken('subject-' . $address, $address)]);
            self::assertResponseStatusCodeSame(403);
            self::assertSame(ErrorCode::SsoSignInRequired->type(), $this->problem()['type'], $address);
        }

        self::assertNull(self::service(UserRepository::class)->findOneByPrimaryEmailAddress('newcomer@ire.events'), 'Google makes no account there');

        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');

        foreach (['julien@ire.events', 'newcomer@ire.events'] as $address) {
            $this->send('POST', '/api/auth/register', ['email' => $address, 'name' => 'Ada', 'password' => self::PASSWORD]);
            self::assertResponseStatusCodeSame(403);
            self::assertSame(ErrorCode::SsoSignInRequired->type(), $this->problem()['type'], 'no password sign-up at the domain, taken or not');
        }
    }

    private function passwordSignIn(string $email): int
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->send('POST', '/api/auth/login', ['email' => $email, 'password' => self::PASSWORD]);

        return $this->client->getResponse()->getStatusCode();
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

    #[Test]
    public function anAdminReadsItAndOnlyAnOwnerChangesIt(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->saveGoogle($owner, $organisation);
        $admin = $this->member('julien@ire.events', 'Julien');
        $this->join($organisation, $admin, SeededRole::Admin);
        $this->signIn($admin);

        $page = $this->send('GET', $this->path($organisation));
        self::assertResponseStatusCodeSame(200);
        self::assertSame([false, 'Google Workspace'], [$page['ownerChanges'], $page['provider']['name'] ?? null]);

        $this->send('DELETE', $this->path($organisation, 'provider'));
        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::OwnerRequired->type(), $this->problem()['type']);
    }

    #[Test]
    public function itNeedsAProvedDomainAndEnterprise(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        self::assertSame('free', $this->send('GET', $this->path($organisation))['plan']);
        $this->publishGoogle();

        $this->send('PUT', $this->path($organisation, 'provider'), $this->google());
        self::assertResponseStatusCodeSame(403);
        self::assertSame([ErrorCode::PlanRequired->type(), PlanFeature::EmailDomains->value], [$this->problem()['type'], $this->problem()['feature']]);

        $this->moveTo($organisation, Plan::Enterprise);
        $this->signIn($owner);
        $this->send('PUT', $this->path($organisation, 'provider'), $this->google());
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::SsoDomainUnproved->type(), $this->problem()['type']);
    }

    private function publishGoogle(): void
    {
        ScriptedProviderDocuments::publish(self::GOOGLE . '/.well-known/openid-configuration', Json\encode([
            'issuer' => self::GOOGLE,
            'authorization_endpoint' => 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_endpoint' => 'https://oauth2.googleapis.com/token',
            'jwks_uri' => 'https://www.googleapis.com/oauth2/v3/certs',
        ]));
    }

    /** @return array<string, string> */
    private function google(): array
    {
        /** @mago-expect lint:no-literal-password */
        return ['protocol' => 'oidc', 'name' => 'Google Workspace', 'issuer' => self::GOOGLE, 'clientId' => '48120-ire.apps.googleusercontent.com', 'clientSecret' => 'gw-7Hq2xL9vR4mK8pT1'];
    }

    private function saveGoogle(User $owner, Organisation $organisation): void
    {
        $this->publishGoogle();
        $this->signIn($owner);
        $this->send('PUT', $this->path($organisation, 'provider'), $this->google());
        self::assertResponseStatusCodeSame(200);
    }

    private function testWorked(Organisation $organisation, User $owner): void
    {
        $settings = self::service(SingleSignOnSettings::class);
        $settings->testWorked($settings->current($this->fresh($organisation)) ?? static::fail('nothing saved'), $this->freshUser($owner), 'folake@ire.events', 'Folake Adeyemi');
        $this->signIn($owner);
    }

    private function testFailed(Organisation $organisation, User $owner, string $said): void
    {
        $settings = self::service(SingleSignOnSettings::class);
        $settings->testFailed($settings->current($this->fresh($organisation)) ?? static::fail('nothing saved'), $this->freshUser($owner), $said);
        $this->signIn($owner);
    }

    /** @return array<string, mixed> */
    private function page(User $user, Organisation $organisation): array
    {
        $this->signIn($user);

        return $this->send('GET', $this->path($organisation));
    }

    private static function metadata(): string
    {
        $certificate = \base64_encode(SecureRandom\bytes(64));

        return <<<XML
            <?xml version="1.0" encoding="UTF-8"?>
            <md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://www.okta.com/exk1a2b3c4">
              <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
                <md:KeyDescriptor use="signing">
                  <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>{$certificate}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
                </md:KeyDescriptor>
                <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://ire-events.okta.com/app/exk1a2b3c4/sso/saml"/>
                <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://ire-events.okta.com/app/exk1a2b3c4/sso/saml"/>
              </md:IDPSSODescriptor>
            </md:EntityDescriptor>
            XML;
    }

    /** @return array{User, Organisation} on Enterprise, with ire.events proved */
    private function proved(): array
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->moveTo($organisation, Plan::Enterprise);
        $entityManager = self::service(EntityManagerInterface::class);
        $domain = new EmailDomain($entityManager->find(Organisation::class, $organisation->getId()) ?? static::fail('gone'), 'ire.events', SecureRandom\string(32), new DateTimeImmutable());
        $entityManager->persist($domain);
        $entityManager->flush();
        ScriptedTxtRecordLookup::publish(EmailDomains::recordName('ire.events'), $domain->getRecordValue());
        $this->signIn($owner);
        $this->send('POST', Str\format('/api/orgs/%s/email-domains/ire.events/verify', $organisation->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(200);

        return [$owner, $organisation];
    }

    /** @return array{User, Organisation} */
    private function organisation(string $address, string $name): array
    {
        $owner = $this->member($address, 'Owner of ' . $name);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return [$owner, $organisation];
    }

    private function moveTo(Organisation $organisation, Plan $plan): void
    {
        self::service(PlanChanger::class)->change($this->fresh($organisation), $plan, 'Ada at Soirely', 'A test needs it.');
        self::service(EntityManagerInterface::class)->flush();
    }

    private function fresh(Organisation $organisation): Organisation
    {
        return self::service(EntityManagerInterface::class)->find(Organisation::class, $organisation->getId()) ?? static::fail('gone');
    }

    private function freshUser(User $user): User
    {
        return self::service(EntityManagerInterface::class)->find(User::class, $user->getId()) ?? static::fail('gone');
    }

    private function member(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function join(Organisation $organisation, User $user, SeededRole $as): void
    {
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $this->fresh($organisation), 'seededAs' => $as]),
        );
        self::service(MembershipMachine::class)->join($this->fresh($organisation), $this->freshUser($user), $role, MembershipStatus::Active, MembershipChannel::Invitation, $this->freshUser($user));
        self::service(EntityManagerInterface::class)->flush();
    }

    private function audited(string $action, Organisation $organisation): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => $organisation->getId()], ['occurredAt' => 'DESC']),
        );
    }

    /** @return array<string, mixed> */
    private function problem(): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
    }

    /** @return list<array{string, string}> */
    private function violations(): array
    {
        self::assertResponseStatusCodeSame(422);

        return Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'code' => Type\string()], true))->coerce($this->problem()['violations'] ?? null),
            static fn (array $violation): array => [$violation['propertyPath'], $violation['code']],
        );
    }

    private function path(Organisation $organisation, string $tail = ''): string
    {
        return Str\format('/api/orgs/%s/single-sign-on', $organisation->getId()->toRfc4122()) . ('' === $tail ? '' : '/' . $tail);
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
