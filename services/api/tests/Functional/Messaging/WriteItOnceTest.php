<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\GuestMessages\MessageTokens;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Guest;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Write it once (sc-3960): Greet as on the guest, the tokens a message holds, and the preview as one guest will see it. */
final class WriteItOnceTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-11-21T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function greetAsIsSavedTrimmedAndOnlySpacesIsNone(): void
    {
        self::assertSame('Auntie Bisi', $this->guest($this->add('Bisi Adewale', ['greetAs' => '  Auntie Bisi  ']))['greetAs']);
        self::assertNull($this->guest($this->add('Kemi Bello', ['greetAs' => '    ']))['greetAs']);
        self::assertNull($this->guest($this->add('Emeka Nwosu'))['greetAs']);
    }

    #[Test]
    public function greetAsTakesSixtyCharactersAfterTrimmingAndRefusesSixtyOne(): void
    {
        $sixty = Str\repeat('é', 60);
        self::assertSame($sixty, $this->guest($this->add('Bisi Adewale', ['greetAs' => '  ' . $sixty . '  ']))['greetAs']);

        $refused = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => 'Kemi Bello', 'greetAs' => $sixty . 'é']);

        self::assertSame(422, $this->statusCode());
        $violation = Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true)->coerce(Type\vec(Type\mixed())->coerce($refused['violations'] ?? null)[0] ?? null);
        self::assertSame('greetAs', $violation['propertyPath']);
        self::assertSame('Shorten Greet as to 60 characters or fewer.', $violation['message']);
    }

    #[Test]
    public function anEditWithoutGreetAsKeepsItAndOneWithItChangesIt(): void
    {
        $id = $this->add('Bisi Adewale', ['greetAs' => 'Auntie Bisi']);

        $this->edit($id, ['fullName' => 'Bisi Adewale-Ojo']);
        self::assertSame('Auntie Bisi', $this->guest($id)['greetAs']);
        self::assertSame('Bisi Adewale-Ojo', $this->guest($id)['fullName']);

        $this->edit($id, ['fullName' => 'Bisi Adewale-Ojo', 'greetAs' => '']);
        self::assertNull($this->guest($id)['greetAs']);
    }

    #[Test]
    public function greetAsIsReadWithGuestsReadAloneAndChangingItIsRefused403(): void
    {
        $id = $this->add('Bisi Adewale', ['greetAs' => 'Auntie Bisi', 'email' => 'bisi@example.test']);

        foreach ([EventRole::CanView, EventRole::CanCheckIn] as $index => $role) {
            $reader = $this->member('reader' . $index . '@ire.events', $role);
            $list = $this->as($reader, 'GET', $this->guests());
            self::assertSame(200, $this->statusCode());
            $row = Type\shape(['greetAs' => Type\nullable(Type\string())], true)->coerce(Type\vec(Type\mixed())->coerce($list['guests'] ?? null)[0] ?? null);
            self::assertSame('Auntie Bisi', $row['greetAs']);
            self::assertArrayNotHasKey('email', Type\dict(Type\string(), Type\mixed())->coerce(Type\vec(Type\mixed())->coerce($list['guests'])[0]));

            $this->as($reader, 'PUT', $this->guests() . '/' . $id, ['fullName' => 'Bisi Adewale', 'greetAs' => 'Bisi'], '*');
            self::assertSame(403, $this->statusCode());
        }
    }

    #[Test]
    public function thePreviewGreetsByGreetAsOrTheFullNameAndSaysWhyTheLanguage(): void
    {
        $bisi = $this->add('Bisi Adewale', ['greetAs' => 'Auntie Bisi', 'email' => 'bisi@example.test', 'language' => 'fr']);
        $kemi = $this->add('Kemi Bello', ['email' => 'kemi@example.test']);

        $preview = $this->preview($bisi);
        self::assertSame(['id' => $bisi, 'name' => 'Bisi Adewale', 'greetAs' => 'Auntie Bisi', 'language' => 'fr', 'languageFrom' => 'host'], $preview['guest']);
        self::assertStringContainsString('Auntie Bisi', $this->email($preview)['text']);

        $theirs = $this->preview($kemi);
        self::assertSame(['id' => $kemi, 'name' => 'Kemi Bello', 'greetAs' => null, 'language' => 'en', 'languageFrom' => 'organisation'], $theirs['guest']);
        self::assertStringContainsString('Dear Kemi Bello,', $this->email($theirs)['text']);
        self::assertSame("Amara & Tobi's wedding: a message from Funmi Adeyemi", $this->email($theirs)['subject']);

        $guest = self::em()->find(Guest::class, $kemi) ?? self::fail('no guest');
        $guest->choseLanguage('pt');
        self::em()->flush();
        self::assertSame(['pt', 'chose'], [$this->preview($kemi)['guest']['language'], $this->preview($kemi)['guest']['languageFrom']]);
    }

    #[Test]
    public function thePreviewNeverShowsTheGuestsOwnLinkAndKeepsMarkupAsText(): void
    {
        $id = $this->add('Bisi Adewale', ['greetAs' => '<b>Bisi</b> & "co"', 'email' => 'bisi@example.test']);
        $token = (self::em()->find(Guest::class, $id) ?? self::fail('no guest'))->getLinkToken() ?? self::fail('no link');

        $text = $this->email($this->preview($id))['text'];

        self::assertStringContainsString('Dear <b>Bisi</b> & "co",', $text);
        self::assertStringNotContainsString($token, $text);
        self::assertStringContainsString('/i/…', $text);
    }

    #[Test]
    public function thePreviewIsForThoseWhoCanSendAndOnlyForAGuestOfThisEvent(): void
    {
        $id = $this->add('Bisi Adewale');

        $this->as($this->member('viewer@ire.events', EventRole::CanView), 'GET', $this->messages() . '/preview/' . $id);
        self::assertSame(403, $this->statusCode());

        $this->as($this->owner, 'GET', $this->messages() . '/preview/00000000-0000-7000-8000-000000000000');
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function thePreviewIs404ForAGuestRemovedFromTheListAndForACompanion(): void
    {
        $removed = $this->add('Bisi Adewale');
        $this->preview($removed);
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $removed);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'GET', $this->messages() . '/preview/' . $removed);
        self::assertSame(404, $this->statusCode());

        $host = $this->add('Kemi Bankole', ['companions' => [['fullName' => 'Tunde Bankole']]]);
        $companion = Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)->coerce($this->guest($host))['companions'][0]['id'] ?? self::fail('no companion');

        $this->as($this->owner, 'GET', $this->messages() . '/preview/' . $companion);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function chooseGuestsGivesTheLanguageEachIsWrittenTo(): void
    {
        $this->add('Bisi Adewale', ['language' => 'fr']);
        $this->add('Kemi Bello');

        $guests = Type\vec(Type\shape(['name' => Type\string(), 'language' => Type\nullable(Type\string())], true))->coerce($this->as($this->owner, 'GET', $this->messages() . '/guests')['guests'] ?? null);

        self::assertSame([['Bisi Adewale', 'fr'], ['Kemi Bello', 'en']], Vec\map($guests, static fn (array $guest): array => [$guest['name'], $guest['language']]));
    }

    #[Test]
    public function typedBracesAndTokensAreKeptAsWrittenAndAMarkThatIsNoTokenIsRefused(): void
    {
        $this->add('Bisi Adewale', ['email' => 'bisi@example.test']);
        $message = 'Dear ' . MessageTokens::token('greeting') . ', see you at {event} on ' . MessageTokens::token('date') . '.';

        $sent = $this->as($this->owner, 'POST', $this->messages(), ['audience' => 'all', 'subject' => 'Hello {greeting}', 'message' => $message]);
        self::assertSame(202, $this->statusCode(), Json\encode($sent));
        self::assertSame(['Hello {greeting}', $message], $this->stored(Type\string()->coerce($sent['id'])));

        foreach (["\u{E000}table\u{E001}", "a lone \u{E000} mark", "\u{E001}greeting"] as $refused) {
            $body = $this->as($this->owner, 'POST', $this->messages(), ['audience' => 'all', 'message' => $refused]);
            self::assertSame(422, $this->statusCode(), $refused);
            self::assertSame('message', Type\shape(['propertyPath' => Type\string()], true)->coerce(Type\vec(Type\mixed())->coerce($body['violations'] ?? null)[0] ?? null)['propertyPath']);
        }
    }

    #[Test]
    public function aMessageWithNoTokensAndAnySubjectIsKeptExactlyAsWritten(): void
    {
        $this->add('Bisi Adewale', ['email' => 'bisi@example.test']);

        $sent = $this->as($this->owner, 'POST', $this->messages(), ['audience' => 'all', 'subject' => 'Dress code: {black tie}', 'message' => "Dinner at seven.\n\nCome hungry!"]);

        self::assertSame(['Dress code: {black tie}', "Dinner at seven.\n\nCome hungry!"], $this->stored(Type\string()->coerce($sent['id'])));
    }

    /** @return array{0: ?string, 1: string} */
    private function stored(string $id): array
    {
        $row = Type\shape(['subject' => Type\nullable(Type\string()), 'body' => Type\string()])->coerce(self::service(Connection::class)->fetchAssociative('SELECT subject, body FROM guest_messages WHERE id = :id', ['id' => $id]));

        return [$row['subject'], $row['body']];
    }

    /** @return array{guest: array<string, mixed>, notices: list<mixed>} */
    private function preview(string $guestId): array
    {
        $body = $this->as($this->owner, 'GET', $this->messages() . '/preview/' . $guestId);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\shape(['guest' => Type\dict(Type\string(), Type\mixed()), 'notices' => Type\vec(Type\mixed())])->coerce($body);
    }

    /**
     * @param array{guest: array<string, mixed>, notices: list<mixed>} $preview
     *
     * @return array{channel: string, subject: string, text: string}
     */
    private function email(array $preview): array
    {
        return Type\shape(['channel' => Type\literal_scalar('email'), 'subject' => Type\string(), 'text' => Type\string()])->coerce($preview['notices'][0] ?? null);
    }

    /** @param array<string, mixed> $fields */
    private function add(string $name, array $fields = []): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), ['fullName' => $name, ...$fields]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    /** @return array<string, mixed> */
    private function guest(string $id): array
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $id);
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? null);
    }

    /** @param array<string, mixed> $fields */
    private function edit(string $id, array $fields): void
    {
        $this->as($this->owner, 'GET', $this->guests() . '/' . $id);
        $tag = $this->client->getResponse()->headers->get('ETag') ?? self::fail('no ETag');
        $body = $this->as($this->owner, 'PUT', $this->guests() . '/' . $id, $fields, $tag);
        self::assertSame(200, $this->statusCode(), Json\encode($body));
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function messages(): string
    {
        return '/api/events/' . $this->eventId . '/messages';
    }

    private function draft(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(string $name): string
    {
        $id = $this->draft($name);
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
        ], content: match ($body) {
            null => null,
            [] => '{}',
            default => Json\encode($body),
        });

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
