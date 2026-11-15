<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationCreator;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

final class CreateOrganisationTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function theCallerOwnsTheNewOrganisationWithItsSeededRolesAndDerivedDefaults(): void
    {
        $user = $this->signedIn('second@ire.events');

        $body = $this->create(['name' => '  Lagos Supper Club ', 'countryCode' => 'gh', 'timezone' => 'Africa/Accra']);

        self::assertResponseStatusCodeSame(201);
        $created = Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'countryCode' => Type\string(),
            'currency' => Type\string(),
            'timezone' => Type\string(),
            'contactAddress' => Type\string(),
            'role' => Type\shape(['seededAs' => Type\string()], true),
        ], true)->coerce($body['organisation']);
        self::assertSame('Lagos Supper Club', $created['name']);
        self::assertSame('GH', $created['countryCode']);
        self::assertSame('GHS', $created['currency'], 'the currency follows the country');
        self::assertSame('Africa/Accra', $created['timezone'], 'the timezone is the device\'s');
        self::assertSame('second@ire.events', $created['contactAddress'], 'the contact is the caller\'s primary address');
        self::assertSame('owner', $created['role']['seededAs']);

        $organisation = self::em()->find(Organisation::class, Uuid::fromString($created['id'])) ?? self::fail('not stored');
        $membership = self::service(MembershipRepository::class)->findActive($user, $organisation->getId()) ?? self::fail('the caller is not a member');
        self::assertTrue($membership->getRole()->isOwner());
        self::assertCount(Iter\count(SeededRole::cases()), self::em()->getRepository(Role::class)->findBy(['organisation' => $organisation]));
        $listed = $this->listed();
        self::assertCount(2, $listed, 'the first organisation stays and the new one joins it');
        self::assertSame($listed[1], $body['organisation'], 'answered as the list shows it, so one parser reads both');
    }

    #[Test]
    public function anUnrecognisedDeviceTimezoneGivesUtc(): void
    {
        $this->signedIn('mars@example.com');

        $body = $this->create(['name' => 'Olympus Events', 'countryCode' => 'NG', 'timezone' => 'Mars/Olympus']);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('UTC', Type\shape(['timezone' => Type\string()], true)->coerce($body['organisation'])['timezone']);
    }

    #[Test]
    public function noTimezoneAtAllGivesUtc(): void
    {
        $this->signedIn('no-zone@example.com');

        $body = $this->create(['name' => 'Zoneless', 'countryCode' => 'NG']);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('UTC', Type\shape(['timezone' => Type\string()], true)->coerce($body['organisation'])['timezone']);
    }

    #[Test]
    public function aBlankNameIsRefusedOnTheNameOnly(): void
    {
        $this->signedIn('blank@example.com');

        $body = $this->create(['name' => '   ', 'countryCode' => 'NG', 'timezone' => 'Mars/Olympus']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['name'], $this->refusedFields($body));
        self::assertCount(1, $this->listed(), 'nothing was created');
    }

    #[Test]
    public function aNameOverOneHundredCharactersIsRefusedOnTheNameOnly(): void
    {
        $this->signedIn('long@example.com');

        $body = $this->create(['name' => Str\repeat('é', 101), 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['name'], $this->refusedFields($body));
    }

    /**
     * The clients' own words, so a caller that skips their check reads the same refusal.
     *
     * @param positive-int $length
     */
    #[Test]
    #[DataProvider('tooLongInEachLanguage')]
    public function anOverLongNameIsRefusedWithItsLengthInTheCallersLanguage(string $language, int $length, string $message): void
    {
        $this->signedIn('long-' . $language . $length . '@example.com');
        $this->client->setServerParameter('HTTP_ACCEPT_LANGUAGE', $language);

        $body = $this->create(['name' => Str\repeat('é', $length), 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([$message], $this->refusedMessages($body));
    }

    /** @return iterable<string, array{string, positive-int, string}> */
    public static function tooLongInEachLanguage(): iterable
    {
        yield 'en' => ['en', 101, 'That name is 101 characters. Use 100 or fewer.'];
        yield 'es' => ['es', 101, 'Ese nombre tiene 101 caracteres. Acórtelo a 100 como máximo.'];
        yield 'fr' => ['fr', 101, 'Ce nom compte 101 caractères. Raccourcissez-le à 100 caractères maximum.'];
        yield 'pt' => ['pt', 101, 'Este nome tem 101 caracteres. Encurte-o para um máximo de 100.'];
        yield 'the length measured' => ['en', 250, 'That name is 250 characters. Use 100 or fewer.'];
    }

    #[Test]
    public function aNameOfExactlyOneHundredCharactersIsAccepted(): void
    {
        $this->signedIn('hundred@example.com');

        $this->create(['name' => Str\repeat('é', 100), 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(201);
    }

    /** A country nobody recognises fails its currency too, which the form does not show. */
    #[Test]
    public function aRefusalReportsOnlyTheFieldsTheFormHas(): void
    {
        $this->signedIn('nowhere@example.com');

        $body = $this->create(['name' => '', 'countryCode' => 'QQ', 'timezone' => 'Mars/Olympus']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['name', 'countryCode'], $this->refusedFields($body));
    }

    #[Test]
    public function theSixthCreationInAnHourIsRefused(): void
    {
        $user = $this->onboarded('six@example.com');
        $creator = self::service(OrganisationCreator::class);

        for ($made = 1; $made <= 5; ++$made) {
            $creator->create($user, 'Organisation ' . $made, 'NG', 'Africa/Lagos');
        }

        try {
            $creator->create($user, 'One too many', 'NG', 'Africa/Lagos');
            self::fail('a sixth organisation was created within the hour');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::TooManyAttempts, $e->errorCode);
            self::assertGreaterThan(0, (int) ($e->headers['Retry-After'] ?? 0));
        }

        self::assertCount(6, self::service(MembershipRepository::class)->findActiveFor($user), 'onboarding\'s and the five');
    }

    #[Test]
    public function aRefusedCreationSpendsNothingFromTheLimit(): void
    {
        $user = $this->onboarded('typos@example.com');
        $creator = self::service(OrganisationCreator::class);

        for ($tried = 1; $tried <= 5; ++$tried) {
            try {
                $creator->create($user, ' ', 'NG', 'Africa/Lagos');
            } catch (ApiException) {
            }
        }

        $created = $creator->create($user, 'At last', 'NG', 'Africa/Lagos');

        self::assertSame('At last', $created->getName());
    }

    #[Test]
    public function theLimitIsA429WithRetryAfterAndTheMinuteItLifts(): void
    {
        $this->signedIn('limited@example.com');
        $this->client->disableReboot();
        self::getContainer()->set('limiter.organisation_create_account', new RefusingRateLimiterFactory());

        $body = $this->create(['name' => 'Lagos Supper Club', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(429);
        self::assertSame(ErrorCode::TooManyAttempts->type(), $body['type']);
        self::assertStringStartsWith('Too many new organisations for now. Try again at ', Type\string()->coerce($body['detail']));
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));
        self::assertCount(1, $this->listed(), 'nothing was created');
    }

    #[Test]
    public function aCreationIsAuditedByTheCallerOnTheNewOrganisation(): void
    {
        $user = $this->signedIn('audited@example.com');

        $body = $this->create(['name' => 'Audited Events', 'countryCode' => 'PT', 'timezone' => 'Europe/Lisbon']);
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['organisation'])['id'];

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'organisation.created']) ?? self::fail('no audit entry');
        self::assertSame('Organisation', $entry->getSubjectType());
        self::assertSame($id, $entry->getSubjectId()->toRfc4122());
        self::assertSame(Actor::User, $entry->getActorType());
        self::assertTrue($user->getId()->equals($entry->getActorId()));
        self::assertSame([null, 'EUR'], $entry->getChanges()['currency']);
    }

    #[Test]
    public function anAccountBehindTheOnboardingGateCannotCreateOne(): void
    {
        $user = self::service(UserRegistrar::class)->register('unverified@example.com', 'Person', self::PASSWORD)->user;
        $this->bearer($user);

        $body = $this->create(['name' => 'Too soon', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::AccountUnverified->type(), $body['type']);
    }

    #[Test]
    public function nobodySignedInCannotCreateOne(): void
    {
        $this->create(['name' => 'Anonymous', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(401);
    }

    /** Onboarded with an organisation of their own, as anybody who can open the switcher is. */
    private function onboarded(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    private function signedIn(string $address): User
    {
        $user = $this->onboarded($address);
        $this->bearer($user);

        return $user;
    }

    private function bearer(User $user): void
    {
        self::em()->flush();
        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );
    }

    /**
     * @param array<string, string> $fields
     *
     * @return array<string, mixed>
     */
    private function create(array $fields): array
    {
        $this->client->request('POST', '/api/orgs', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($fields));

        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return list<string>
     */
    private function refusedFields(array $body): array
    {
        return Vec\map(
            Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']),
            static fn (array $violation): string => $violation['propertyPath'] ?? '',
        );
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return list<string>
     */
    private function refusedMessages(array $body): array
    {
        return Vec\map(
            Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']),
            static fn (array $violation): string => $violation['message'] ?? '',
        );
    }

    /** @return list<mixed> */
    private function listed(): array
    {
        $this->client->request('GET', '/api/orgs');

        return Type\shape(['organisations' => Type\vec(Type\mixed())], true)
            ->coerce(Json\decode((string) $this->client->getResponse()->getContent()))['organisations'];
    }
}
