<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Enum\VendorCategory;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** Settings › Vendors (sc-82): the organisation's directory, its form's rules, Archive and Restore, and who reaches it. */
final class VendorsTest extends ApiTestCase
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
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'GB', 'Europe/London');
        self::em()->flush();
    }

    #[Test]
    public function aVendorIsAddedWithItsFieldsTrimmedTheWebsiteGivenItsSchemeAndThePhoneInE164(): void
    {
        $vendor = $this->add([
            'name' => '  Bloom & Co ',
            'category' => 'flowers',
            'contactName' => ' Ngozi Eze ',
            'emailAddress' => 'ngozi@bloomandco.co.uk',
            'phoneCountryCode' => 'GB',
            'phoneNumber' => '020 7946 0958',
            'website' => 'bloom.co',
            'address' => '',
            'note' => '   ',
        ]);

        self::assertSame('Bloom & Co', $vendor['name']);
        self::assertSame('flowers', $vendor['category']);
        self::assertSame('Ngozi Eze', $vendor['contactName']);
        self::assertSame('+442079460958', $vendor['phoneNumber'], 'a landline is a vendor number too');
        self::assertSame('GB', $vendor['phoneCountryCode']);
        self::assertSame('https://bloom.co', $vendor['website']);
        self::assertNull($vendor['address']);
        self::assertNull($vendor['note']);
        self::assertNull($vendor['archivedAt']);
    }

    #[Test]
    public function onlyNameAndCategoryAreNeededAndTwoVendorsMayShareAName(): void
    {
        $this->add(['name' => 'The Landmark', 'category' => 'venue']);
        $this->add(['name' => 'the landmark', 'category' => 'venue']);

        self::assertSame(2, $this->list()['total']);
    }

    #[Test]
    public function theOpenApiDocumentOffersTheNineCategoriesInTheFormsOrder(): void
    {
        self::assertSame(VendorCategory::VALUES, Vec\map(VendorCategory::cases(), static fn (VendorCategory $case): string => $case->value));
    }

    #[Test]
    public function eachRefusalIsAtItsField(): void
    {
        $refused = [
            [['name' => '   ', 'category' => 'venue'], 'name', "Enter the vendor's name."],
            [['name' => 'Bloom', 'category' => ''], 'category', 'Choose the category.'],
            [['name' => 'Bloom', 'category' => 'florist'], 'category', 'Choose the category.'],
            [['name' => Str\repeat('a', 101), 'category' => 'venue'], 'name', 'Shorten the name to 100 characters or fewer.'],
            [['name' => 'Bloom', 'category' => 'venue', 'note' => Str\repeat('a', 1001)], 'note', 'Shorten the note to 1,000 characters or fewer.'],
            [['name' => 'Bloom', 'category' => 'venue', 'emailAddress' => 'sam@'], 'emailAddress', 'That does not look like an email address. Check it has an @ and a domain.'],
            [['name' => 'Bloom', 'category' => 'venue', 'website' => Str\repeat('a', 2041)], 'website', 'Shorten the website to 2,048 characters or fewer.'],
            [['name' => 'Bloom', 'category' => 'venue', 'website' => 'ftp://bloom.co'], 'website', 'Enter a web address that starts with https:// or http://, or leave that part off.'],
            [['name' => 'Bloom', 'category' => 'venue', 'phoneCountryCode' => 'GB', 'phoneNumber' => '000 000 0000'], 'phoneNumber', 'That is not a phone number for United Kingdom. Check it and try again.'],
            [['name' => 'Bloom', 'category' => 'venue', 'phoneCountryCode' => 'GB', 'phoneNumber' => '020'], 'phoneNumber', 'That number looks too short for United Kingdom. Check it and try again.'],
            [['name' => 'Bloom', 'category' => 'venue', 'phoneCountryCode' => '', 'phoneNumber' => '020 7946 0958'], 'phoneCountryCode', 'Choose a country.'],
        ];

        foreach ($refused as [$typed, $field, $words]) {
            $body = $this->send('POST', '', $typed, 422);
            $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations']);

            self::assertSame([[$field, $words]], Vec\map($violations, static fn (array $one): array => [$one['propertyPath'], $one['message']]), Json\encode($typed));
        }

        self::assertSame(0, $this->list()['total'], 'nothing refused was saved');
    }

    #[Test]
    public function eachLimitIsInVisibleCharactersHoweverManyCodePointsEachTakes(): void
    {
        $letter = "e\u{0323}\u{0300}";
        $vendor = $this->add([
            'name' => Str\repeat($letter, 100),
            'category' => 'catering',
            'contactName' => Str\repeat($letter, 100),
            'website' => Str\repeat('a', 2040),
            'address' => Str\repeat($letter, 300),
            'note' => Str\repeat($letter, 1000),
        ]);

        self::assertSame(Str\repeat($letter, 100), $vendor['name']);
        self::assertSame('https://' . Str\repeat('a', 2040), $vendor['website'], 'the limit holds the scheme added');
        self::assertSame(Str\repeat($letter, 1000), $vendor['note']);
    }

    #[Test]
    public function theDirectoryIsInNameOrderIgnoringCaseTwentyFiveAPage(): void
    {
        foreach (Vec\range(2, 26, 2) as $n) {
            $this->add(['name' => Str\format('a vendor %02d', $n), 'category' => 'other']);
        }

        foreach (Vec\range(1, 27, 2) as $n) {
            $this->add(['name' => Str\format('A vendor %02d', $n), 'category' => 'other']);
        }

        $first = $this->list();
        $second = $this->list('?page=2');

        self::assertCount(25, $first['vendors']);
        self::assertSame(27, $first['total']);
        self::assertSame(['A vendor 01', 'a vendor 02', 'A vendor 03'], Vec\take($this->names($first), 3));
        self::assertSame(['A vendor 27'], Vec\take(Vec\reverse($this->names($second)), 1));
        self::assertCount(2, $second['vendors']);
        self::assertSame(2, $second['page']);
    }

    #[Test]
    public function anAccentedNameSortsWithItsPlainLetter(): void
    {
        foreach (['zeta Hire', 'Ómega Music', 'Marquee Masters', 'Éclat Catering', 'Àbẹ̀ní Flowers', 'bloom & Co'] as $name) {
            $this->add(['name' => $name, 'category' => 'other']);
        }

        self::assertSame(['Àbẹ̀ní Flowers', 'bloom & Co', 'Éclat Catering', 'Marquee Masters', 'Ómega Music', 'zeta Hire'], $this->names($this->list()));
    }

    #[Test]
    public function searchMatchesANameContainingItIgnoringCaseWithAccentsAsTyped(): void
    {
        $this->add(['name' => 'Éclat Catering', 'category' => 'catering']);
        $this->add(['name' => 'Bloom & Co', 'category' => 'flowers']);
        $this->add(['name' => 'Wild Meadow Flowers', 'category' => 'flowers']);

        self::assertSame(['Bloom & Co'], $this->names($this->list('?q=BLOOM')));
        self::assertSame(['Éclat Catering'], $this->names($this->list('?q=éclat')));
        self::assertSame([], $this->names($this->list('?q=eclat')));
        self::assertSame(['Wild Meadow Flowers'], $this->names($this->list('?q=o&category=flowers&q=meadow')));
        self::assertSame(0, $this->list('?q=100%25')['total'], 'a wildcard is a letter');
    }

    #[Test]
    public function archiveTakesAVendorOutOfInUseAndRestorePutsItBackAsItWas(): void
    {
        $bloom = $this->add(['name' => 'Bloom & Co', 'category' => 'flowers', 'contactName' => 'Ngozi Eze']);
        $this->add(['name' => 'Savour Kitchen', 'category' => 'catering']);
        $id = Type\string()->coerce($bloom['id']);

        $archived = Type\dict(Type\string(), Type\mixed())->coerce($this->send('POST', "/{$id}/archive")['vendor']);
        $inUse = $this->list();
        $gone = $this->list('?view=archived');

        self::assertNotNull($archived['archivedAt']);
        self::assertSame(['Savour Kitchen'], $this->names($inUse));
        self::assertSame(['Bloom & Co'], $this->names($gone));
        self::assertSame([1, 1], [$inUse['inUse'], $inUse['archived']]);
        self::assertSame(1, Type\dict(Type\string(), Type\int())->coerce($gone['categories'])['flowers']);
        self::assertSame(0, Type\dict(Type\string(), Type\int())->coerce($gone['categories'])['catering'], 'the category menu counts within the view');

        $restored = Type\dict(Type\string(), Type\mixed())->coerce($this->send('POST', "/{$id}/restore")['vendor']);

        self::assertSame([...$bloom, 'archivedAt' => null], $restored);
        self::assertSame(['Bloom & Co', 'Savour Kitchen'], $this->names($this->list()));
    }

    #[Test]
    public function anEditSendsEveryFieldAndABlankOneIsCleared(): void
    {
        $bloom = $this->add(['name' => 'Bloom & Co', 'category' => 'flowers', 'contactName' => 'Ngozi Eze', 'website' => 'https://bloom.co']);
        $id = Type\string()->coerce($bloom['id']);

        $edited = Type\dict(Type\string(), Type\mixed())->coerce($this->send('PUT', "/{$id}", ['name' => 'Bloom and Co', 'category' => 'hire', 'contactName' => '', 'website' => 'http://bloom.co'])['vendor']);

        self::assertSame(['Bloom and Co', 'hire', null, 'http://bloom.co'], [$edited['name'], $edited['category'], $edited['contactName'], $edited['website']]);
    }

    #[Test]
    public function anArchivedVendorIsReadOnlyUntilItIsRestored(): void
    {
        $bloom = $this->add(['name' => 'Bloom & Co', 'category' => 'flowers', 'contactName' => 'Ngozi Eze']);
        $id = Type\string()->coerce($bloom['id']);
        $archived = Type\dict(Type\string(), Type\mixed())->coerce($this->send('POST', "/{$id}/archive")['vendor']);
        $change = ['name' => 'Bloom and Co', 'category' => 'hire', 'contactName' => ''];

        $refused = $this->send('PUT', "/{$id}", $change, 409);

        self::assertSame('https://soirely.com/errors/conflict', $refused['type']);
        self::assertSame('This vendor is archived, so your changes were not saved. To edit it, restore it under Archived.', $refused['detail']);
        self::assertSame([$archived], Type\vec(Type\mixed())->coerce($this->list('?view=archived')['vendors']));

        $this->send('POST', "/{$id}/restore");
        $edited = Type\dict(Type\string(), Type\mixed())->coerce($this->send('PUT', "/{$id}", $change)['vendor']);

        self::assertSame(['Bloom and Co', 'hire', null], [$edited['name'], $edited['category'], $edited['contactName']]);
    }

    #[Test]
    public function aMemberHoldsNeitherPermission(): void
    {
        $bloom = $this->add(['name' => 'Bloom & Co', 'category' => 'flowers']);
        $member = $this->member('ana');
        $id = Type\string()->coerce($bloom['id']);

        foreach ([['GET', ''], ['POST', ''], ['PUT', "/{$id}"], ['POST', "/{$id}/archive"], ['POST', "/{$id}/restore"]] as [$method, $path]) {
            $body = $this->send($method, $path, ['name' => 'Bloom', 'category' => 'flowers'], 403, $member);

            self::assertSame('https://soirely.com/errors/permission_required', $body['type'], "{$method} {$path}");
        }
    }

    #[Test]
    public function anotherOrganisationsVendorReadsAsNotFound(): void
    {
        $theirs = $this->account('kofi@savour.co.uk', 'Kofi Mensah');
        $elsewhere = self::service(OrganisationFounder::class)->found($theirs, 'Savour', 'GB', 'Europe/London');
        self::em()->flush();
        $this->client->request('POST', Str\format('/api/orgs/%s/vendors', $elsewhere->getId()->toRfc4122()), server: $this->bearer($theirs), content: Json\encode(['name' => 'Theirs', 'category' => 'venue']));
        $id = Type\string()->coerce(Type\shape(['vendor' => Type\shape(['id' => Type\string()], true)], true)->coerce(Json\decode((string) $this->client->getResponse()->getContent()))['vendor']['id']);

        foreach ([['PUT', "/{$id}"], ['POST', "/{$id}/archive"], ['POST', "/{$id}/restore"]] as [$method, $path]) {
            $body = $this->send($method, $path, ['name' => 'Mine now', 'category' => 'venue'], 404);

            self::assertSame('https://soirely.com/errors/not_found', $body['type']);
        }

        self::assertSame(0, $this->list()['total']);
        $this->send('GET', '', null, 404, $theirs, $this->organisation);
    }

    /** @param array<string, string> $typed */
    private function add(array $typed): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($this->send('POST', '', $typed, 201)['vendor']);
    }

    /** @return array<string, mixed> */
    private function list(string $query = ''): array
    {
        return $this->send('GET', $query);
    }

    /**
     * @param ?array<string, string> $body
     *
     * @return array<string, mixed>
     */
    private function send(string $method, string $path, ?array $body = null, int $status = 200, ?User $as = null, ?Organisation $in = null): array
    {
        $this->client->request(
            $method,
            Str\format('/api/orgs/%s/vendors%s', ($in ?? $this->organisation)->getId()->toRfc4122(), $path),
            server: [...$this->bearer($as ?? $this->owner), 'CONTENT_TYPE' => 'application/json'],
            content: null === $body || 'GET' === $method ? null : Json\encode($body),
        );
        $answer = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
        self::assertSame($status, $this->client->getResponse()->getStatusCode(), Json\encode($answer));

        return $answer;
    }

    /** @return array<string, string> */
    private function bearer(User $as): array
    {
        $who = self::em()->find(User::class, $as->getId()) ?? self::fail('no caller');

        return ['HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who)];
    }

    /** @param array<string, mixed> $page */
    private function names(array $page): array
    {
        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($page['vendors']), static fn (array $one): string => $one['name']);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $name): User
    {
        $user = $this->account($name . '@ire.events', Str\uppercase($name[0]) . Str\slice($name, 1));
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }
}
