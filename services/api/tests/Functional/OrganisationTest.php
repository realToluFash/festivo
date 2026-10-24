<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Regions;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\Access\FixtureDirectories;
use App\Tests\Fixtures\Access\FixtureTable;
use App\Tests\Fixtures\Access\FixtureTableRepository;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use NumberFormatter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use ResourceBundle;
use stdClass;
use Symfony\Component\Uid\Uuid;

final class OrganisationTest extends ApiTestCase
{
    use InvitesPeople;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function foundingMakesTheFounderItsOwnerWithDefaultsFromCountryDeviceAndAddress(): void
    {
        $owner = $this->account('folake@ire.events');

        $organisation = $this->found($owner, '  Ìrè Events ', 'ng', 'Africa/Lagos');

        self::assertSame('Ìrè Events', $organisation->getName());
        self::assertSame('NG', $organisation->getCountryCode());
        self::assertSame('NGN', $organisation->getCurrency(), 'the currency follows the country');
        self::assertSame('Africa/Lagos', $organisation->getTimezone(), 'the timezone is the device\'s');
        self::assertSame('folake@ire.events', $organisation->getContactAddress(), 'the contact is the owner\'s address');
        self::assertSame('en', $organisation->getLocale(), 'the language is the founder\'s');

        $membership = self::service(MembershipRepository::class)->findActive($owner, $organisation->getId());
        self::assertNotNull($membership);
        self::assertTrue($membership->getRole()->isOwner());
    }

    #[Test]
    public function foundingRefusesEveryBadFieldAtOnce(): void
    {
        $owner = $this->account('bad-fields@example.com');

        try {
            $this->found($owner, '   ', 'QQ', 'Mars/Olympus');
            self::fail('an organisation was founded from nothing');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::ValidationFailed, $e->errorCode);
            self::assertSame(
                ['name', 'countryCode', 'timezone'],
                \array_column($e->violations, 'propertyPath'),
                'a country nobody recognises has no currency to follow, so only the fields given are refused',
            );
        }
    }

    /** Distinguished by how the account was created, not by a later check. */
    #[Test]
    public function anInvitedAccountIsRecordedAsSuchAndGetsNoOrganisation(): void
    {
        $invited = self::service(UserRegistrar::class)
            ->registerFromInvitation(self::invitationTo('invited@example.com')[0], 'Invited', self::PASSWORD)
            ->user;
        self::onboard($invited);
        $selfRegistered = $this->account('own@example.com');

        self::assertSame(AccountOrigin::Invitation, $invited->getOrigin());
        self::assertSame(AccountOrigin::SelfRegistered, $selfRegistered->getOrigin());

        $this->signIn($invited);
        self::assertSame([], $this->list());
    }

    #[Test]
    public function theListShowsEachOrganisationWithTheCallersRole(): void
    {
        $owner = $this->account('several@example.com');
        $first = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $second = $this->found($owner, 'Okafor Family', 'GH', 'Africa/Accra');
        $this->found($this->account('stranger@example.com'), 'Not Yours', 'PT', 'Europe/Lisbon');

        $this->signIn($owner);
        $listed = $this->list();

        self::assertSame(
            [$first->getId()->toRfc4122(), $second->getId()->toRfc4122()],
            \array_column($listed, 'id'),
            'both of the caller\'s, oldest first, and nobody else\'s',
        );
        self::assertSame('owner', Type\shape(['seededAs' => Type\string()], true)->coerce($listed[1]['role'])['seededAs']);
        self::assertSame('GHS', $listed[1]['currency']);
    }

    #[Test]
    public function theOwnerCanChangeAnyFieldAndTheRestStay(): void
    {
        $owner = $this->account('edits@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['name' => 'Ìrè Events Ltd', 'currency' => 'usd']);

        self::assertResponseStatusCodeSame(200);
        self::assertSame('Ìrè Events Ltd', $body['name']);
        self::assertSame('USD', $body['currency']);
        self::assertSame('NG', $body['countryCode'], 'a field left out keeps its value');
        self::assertSame('Africa/Lagos', $body['timezone']);
    }

    #[Test]
    public function aCountryWhoseCurrencyIsNewlyIssuedFoundsWithIt(): void
    {
        $owner = $this->account('freetown@example.com');

        self::assertSame('SLE', $this->found($owner, 'Freetown Events', 'SL', 'Africa/Freetown')->getCurrency());
        self::assertSame('ZWG', $this->found($owner, 'Harare Events', 'ZW', 'Africa/Harare')->getCurrency());
    }

    #[Test]
    public function everyCountryWithMoneyOfItsOwnFoundsWithACurrencyInUseToday(): void
    {
        $owner = $this->account('everywhere@example.com');
        $countries = Vec\filter(
            Vec\keys(\iterator_to_array(Type\instance_of(ResourceBundle::class)->assert(ResourceBundle::create('en', 'ICUDATA-region')?->get('Countries')))),
            static fn (int|string $code): bool => Regions::isCountry((string) $code),
        );

        foreach ($countries as $country) {
            $icu = new NumberFormatter('en_' . $country, NumberFormatter::CURRENCY)
                ->getTextAttribute(NumberFormatter::CURRENCY_CODE);
            if ('XXX' === $icu) {
                continue;
            }

            $currency = self::service(OrganisationFounder::class)
                ->found($owner, 'Events', (string) $country, 'Europe/London')
                ->getCurrency();

            self::assertTrue(Regions::isCurrency($currency), Str\format('%s founds with "%s"', $country, $currency));
        }
    }

    #[Test]
    public function aCountryWhoseCurrencyChangedAfterIcuFoundsWithTheNewOne(): void
    {
        $owner = $this->account('sofia@example.com');

        self::assertSame('EUR', $this->found($owner, 'Sofia Events', 'BG', 'Europe/Sofia')->getCurrency());
    }

    #[Test]
    public function aCountryWithNoCurrencyOfItsOwnFoundsWithNone(): void
    {
        $owner = $this->account('antarctica@example.com');

        self::assertSame('', $this->found($owner, 'McMurdo Events', 'AQ', 'Antarctica/McMurdo')->getCurrency());
    }

    #[Test]
    public function onlyACurrencyInUseTodayIsAccepted(): void
    {
        $owner = $this->account('currencies@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        foreach (['SLL', 'ZWL', 'HRK', 'XXX', 'XTS', 'XAU', 'BOV', ''] as $refused) {
            $body = $this->patch($organisation, ['currency' => $refused, 'name' => 'Ìrè Events Ltd']);

            self::assertResponseStatusCodeSame(422, $refused);
            self::assertSame([['propertyPath' => 'currency', 'message' => 'Choose a currency.']], self::violations($body), $refused);
        }

        self::assertSame(['NGN', 'Ìrè Events'], [$this->list()[0]['currency'], $this->list()[0]['name']], 'nothing was saved');

        foreach (Regions::CURRENCIES as $offered) {
            $this->patch($organisation, ['currency' => $offered]);

            self::assertResponseStatusCodeSame(200, $offered);
        }

        self::assertSame('SLE', $this->patch($organisation, ['currency' => 'SLE'])['currency']);
    }

    #[Test]
    public function aHeldCurrencyNoLongerInUseSurvivesASaveOfTheOtherFieldsUntilItIsChanged(): void
    {
        $owner = $this->account('retired@example.com');
        $organisation = $this->found($owner, 'Freetown Events', 'SL', 'Africa/Freetown');
        $organisation->setCurrency('SLL');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['name' => 'Freetown Events Ltd']);

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['SLL', 'Freetown Events Ltd'], [$body['currency'], $body['name']]);

        $this->patch($organisation, ['currency' => 'SLE']);
        self::assertResponseStatusCodeSame(200);

        $this->patch($organisation, ['currency' => 'SLL']);
        self::assertResponseStatusCodeSame(422, 'once changed away, it cannot be chosen again');
    }

    #[Test]
    public function anOrganisationWithNoCurrencyCannotBeSavedWithoutOne(): void
    {
        $owner = $this->account('no-currency@example.com');
        $organisation = $this->found($owner, 'McMurdo Events', 'AQ', 'Antarctica/McMurdo');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['name' => 'McMurdo Events Ltd']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['propertyPath' => 'currency', 'message' => 'Choose a currency.']], self::violations($body));
        self::assertSame(['', 'McMurdo Events'], [$this->list()[0]['currency'], $this->list()[0]['name']]);

        self::assertSame('USD', $this->patch($organisation, ['currency' => 'USD'])['currency']);
    }

    #[Test]
    public function aFounderReadingFrenchFoundsAFrenchOrganisation(): void
    {
        $owner = $this->account('fr@example.com');
        $owner->setLocale('fr');

        self::assertSame('fr', $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos')->getLocale());
    }

    #[Test]
    public function theOwnerChangesTheLanguageAndEveryListReadsIt(): void
    {
        $owner = $this->account('language@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['locale' => ' FR ']);

        self::assertResponseStatusCodeSame(200);
        self::assertSame('fr', $body['locale']);
        self::assertSame('Ìrè Events', $body['name'], 'the rest stay');
        self::assertSame('fr', $this->list()[0]['locale']);
    }

    #[Test]
    public function aLanguageThatIsNotOneOfTheFourIsRefusedAndNothingChanges(): void
    {
        $owner = $this->account('german@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['locale' => 'de', 'name' => 'Ìrè Events Ltd']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(
            [['propertyPath' => 'locale', 'message' => 'Choose English, Español, Français or Português.']],
            Vec\map(
                Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations']),
                static fn (array $violation): array => ['propertyPath' => $violation['propertyPath'], 'message' => $violation['message']],
            ),
        );
        self::assertSame(['en', 'Ìrè Events'], [$this->list()[0]['locale'], $this->list()[0]['name']]);
    }

    #[Test]
    public function aRoleWithoutTheOrganisationPermissionCannotChangeTheLanguage(): void
    {
        $owner = $this->account('keeps-it@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $coordinator = $this->account('coordinator@example.com');
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation->getId(), 'seededAs' => SeededRole::Coordinator]),
        );
        self::service(MembershipMachine::class)->join($organisation, $coordinator, $role, MembershipStatus::Active, MembershipChannel::Invitation, $coordinator);
        $this->signIn($coordinator);

        $body = $this->patch($organisation, ['locale' => 'pt']);

        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PermissionRequired->type(), $body['type']);
        self::assertSame('en', $this->list()[0]['locale']);
    }

    #[Test]
    public function anEditIsRefusedAgainstTheFieldsItGotWrong(): void
    {
        $owner = $this->account('wrong-edit@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['name' => ' ', 'contactAddress' => 'hello at ire']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(
            ['name', 'contactAddress'],
            \array_column(Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']), 'propertyPath'),
        );
    }

    #[Test]
    public function aNameIsTrimmedAndHeldToOneHundredCharacters(): void
    {
        $owner = $this->account('long-name@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['name' => '  ' . Str\repeat('é', 100) . '  ']);
        self::assertResponseStatusCodeSame(200);
        self::assertSame(Str\repeat('é', 100), $body['name']);

        $body = $this->patch($organisation, ['name' => Str\repeat('é', 101)]);
        self::assertResponseStatusCodeSame(422);
        self::assertSame([['propertyPath' => 'name', 'message' => 'That name is 101 characters. Use 100 or fewer.']], self::violations($body));
    }

    /** @return iterable<string, array{string, mixed, string}> */
    public static function countriesOfTheWrongShape(): iterable
    {
        yield 'null, en' => ['en', null, 'Choose a country.'];
        yield 'null, es' => ['es', null, 'Elija un país.'];
        yield 'null, fr' => ['fr', null, 'Choisissez un pays.'];
        yield 'null, pt' => ['pt', null, 'Escolha um país.'];
        yield 'a number, en' => ['en', 42, 'Choose a country.'];
        yield 'a number, fr' => ['fr', 42, 'Choisissez un pays.'];
        yield 'null, an unknown language' => ['xx', null, 'Choose a country.'];
    }

    #[Test]
    #[DataProvider('countriesOfTheWrongShape')]
    public function aCountryOfTheWrongShapeIsRefusedAsAMissingChoice(string $language, mixed $country, string $refusal): void
    {
        $owner = $this->account(Str\format('shape-%s-%s@example.com', $language, \get_debug_type($country)));
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['countryCode' => $country], $language);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type']);
        self::assertSame([['propertyPath' => 'countryCode', 'message' => $refusal, 'code' => 'invalid_shape']], $body['violations']);
        self::assertSame('NG', $this->list()[0]['countryCode']);
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function languagesOfTheShapeRefusal(): iterable
    {
        yield 'en' => ['en', 'This field cannot take that value. Check it and try again.', 'The request does not have the expected shape.'];
        yield 'an unknown language' => ['xx', 'This field cannot take that value. Check it and try again.', 'The request does not have the expected shape.'];

        foreach (['es', 'fr', 'pt'] as $language) {
            $catalogue = Type\dict(Type\string(), Type\string())->coerce(Json\decode(File\read(Str\format('%s/translations/messages.%s.json', \dirname(__DIR__, 2), $language))));

            yield $language => [$language, $catalogue['validation.invalid_shape'], $catalogue['validation.request_shape']];
        }
    }

    #[Test]
    #[DataProvider('languagesOfTheShapeRefusal')]
    public function anyOtherFieldOfTheWrongShapeIsRefusedInThePersonsLanguageWithoutTheParsersWords(string $language, string $refusal, string $detail): void
    {
        $owner = $this->account(Str\format('shape-name-%s@example.com', $language));
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->patch($organisation, ['name' => true], $language);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['propertyPath' => 'name', 'message' => $refusal, 'code' => 'invalid_shape']], $body['violations']);
        self::assertSame($detail, $body['detail']);
        self::assertDoesNotMatchRegularExpression('/coerce|type|array\{|string|int\b/i', Json\encode([$body['detail'], $body['violations']]));
    }

    #[Test]
    public function aMissingRequiredFieldIsRefusedWithTheSameSentence(): void
    {
        $owner = $this->account('shape-missing@example.com');
        $this->signIn($owner);

        $this->client->request('POST', '/api/orgs', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['countryCode' => 'NG']));
        $body = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['propertyPath' => 'name', 'message' => 'This field cannot take that value. Check it and try again.', 'code' => 'invalid_shape']], $body['violations']);
    }

    #[Test]
    #[DataProvider('languagesOfTheShapeRefusal')]
    public function aListForABodyIsRefusedInThePersonsLanguageAndChangesNothing(string $language, string $refusal, string $detail): void
    {
        $owner = $this->account(Str\format('shape-list-%s@example.com', $language));
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $body = $this->send('PATCH', '/api/orgs/' . $organisation->getId()->toRfc4122(), '[1,2]', $language);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(ErrorCode::ValidationFailed->type(), $body['type']);
        self::assertSame([['propertyPath' => '', 'message' => $refusal, 'code' => 'invalid_shape']], $body['violations']);
        self::assertSame($detail, $body['detail']);
        self::assertSame('Ìrè Events', $this->list()[0]['name']);
        self::assertSame('NG', $this->list()[0]['countryCode']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function bodiesThatAreNotAnObject(): iterable
    {
        foreach (['PATCH {org}', 'POST /api/orgs', 'POST {org}/events', 'POST /api/auth/refresh'] as $route) {
            foreach (['[1,2]', '[]', '"Ìrè"', '42', 'true', 'false', 'null'] as $content) {
                yield Str\format('%s with %s', $route, $content) => [$route, $content];
            }
        }
    }

    #[Test]
    #[DataProvider('bodiesThatAreNotAnObject')]
    public function everyRouteReadingABodyRefusesOneThatIsNotAnObject(string $route, string $content): void
    {
        $owner = $this->account(Str\format('shape-body-%s@example.com', \md5($route . $content)));
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);
        $path = '/api/orgs/' . $organisation->getId()->toRfc4122();
        [$method, $uri] = match ($route) {
            'PATCH {org}' => ['PATCH', $path],
            'POST {org}/events' => ['POST', $path . '/events'],
            default => Str\split($route, ' '),
        };

        $body = $this->send($method, $uri, $content);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['propertyPath' => '', 'message' => 'This field cannot take that value. Check it and try again.', 'code' => 'invalid_shape']], $body['violations']);
        self::assertSame('The request does not have the expected shape.', $body['detail']);
    }

    #[Test]
    public function anEmptyObjectIsStillAPatchThatChangesNothing(): void
    {
        $owner = $this->account('shape-empty-object@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $this->send('PATCH', '/api/orgs/' . $organisation->getId()->toRfc4122(), '{}');

        self::assertResponseStatusCodeSame(200);
        self::assertSame('NG', $this->list()[0]['countryCode']);
    }

    #[Test]
    public function aValidCountrySavesAndAnUnknownOneIsStillRefusedByTheRules(): void
    {
        $owner = $this->account('shape-valid@example.com');
        $organisation = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->signIn($owner);

        $this->patch($organisation, ['countryCode' => 'GH']);
        self::assertResponseStatusCodeSame(200);
        self::assertSame('GH', $this->list()[0]['countryCode']);

        $body = $this->patch($organisation, ['countryCode' => 'XX']);
        self::assertResponseStatusCodeSame(422);
        self::assertSame([['propertyPath' => 'countryCode', 'message' => 'Choose a country.', 'code' => 'validation_failed']], $body['violations']);
    }

    /** The access layer's 404, not 403: somebody outside is not told the organisation exists. */
    #[Test]
    public function somebodyOutsideTheOrganisationCannotEditIt(): void
    {
        $organisation = $this->found($this->account('owns-it@example.com'), 'Ìrè Events', 'NG', 'Africa/Lagos');
        $outsider = $this->account('outsider@example.com');
        $this->found($outsider, 'Elsewhere', 'NG', 'Africa/Lagos');
        $this->signIn($outsider);

        $this->patch($organisation, ['name' => 'Taken over']);

        self::assertResponseStatusCodeSame(404);
    }

    #[Test]
    public function anEventIsReachableOnlyThroughItsOwnOrganisation(): void
    {
        $owner = $this->account('event-owner@example.com');
        $mine = $this->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $theirs = $this->found($this->account('event-other@example.com'), 'Others', 'NG', 'Africa/Lagos');

        $myEvent = Uuid::v7();
        $theirEvent = Uuid::v7();
        $myTable = new FixtureTable(Uuid::v7(), $myEvent);
        $theirTable = new FixtureTable(Uuid::v7(), $theirEvent);
        FixtureTableRepository::$tables = [$myTable, $theirTable];

        $this->signIn($owner);
        $this->client->disableReboot();
        self::getContainer()->set(EventDirectoryInterface::class, new FixtureDirectories([], [
            $myEvent->toRfc4122() => $mine->getId(),
            $theirEvent->toRfc4122() => $theirs->getId(),
        ]));

        $this->client->request('GET', Str\format('/api/_access/events/%s/tables/%s', $myEvent->toRfc4122(), $myTable->id->toRfc4122()));
        self::assertResponseStatusCodeSame(200);

        $this->client->request('GET', Str\format('/api/_access/events/%s/tables/%s', $theirEvent->toRfc4122(), $theirTable->id->toRfc4122()));
        self::assertResponseStatusCodeSame(404);
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return list<array{propertyPath: string, message: string}>
     */
    private static function violations(array $body): array
    {
        return Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations']),
            static fn (array $violation): array => ['propertyPath' => $violation['propertyPath'], 'message' => $violation['message']],
        );
    }

    /** Through the gate but in no organisation, so each test founds the ones it means. */
    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function found(User $owner, string $name, string $country, string $timezone): Organisation
    {
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, $country, $timezone);
        self::service(EntityManagerInterface::class)->flush();

        return $organisation;
    }

    private function signIn(User $user): void
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );
    }

    /** @return list<array<string, mixed>> */
    private function list(): array
    {
        $this->client->request('GET', '/api/orgs');
        self::assertResponseStatusCodeSame(200);

        return Type\shape(['organisations' => Type\vec(Type\dict(Type\string(), Type\mixed()))])
            ->coerce(Json\decode((string) $this->client->getResponse()->getContent()))['organisations'];
    }

    /**
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function patch(Organisation $organisation, array $fields, string $language = 'en'): array
    {
        return $this->send('PATCH', '/api/orgs/' . $organisation->getId()->toRfc4122(), Json\encode([] === $fields ? new stdClass() : $fields), $language);
    }

    /** @return array<string, mixed> */
    private function send(string $method, string $uri, string $content, string $language = 'en'): array
    {
        $this->client->request($method, $uri, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => $language], content: $content);

        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
    }
}
