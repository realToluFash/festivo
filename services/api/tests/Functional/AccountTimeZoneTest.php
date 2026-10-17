<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Mail\UserMailer;
use App\Domain\User\Password\PasswordChangeMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use Psl\Vec;
use stdClass;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;

final class AccountTimeZoneTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string AT = '2026-10-17 13:05:00 UTC';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(self::AT);
    }

    #[Test]
    public function aLagosAccountGetsItsTimesInWat(): void
    {
        $user = $this->registered('folake@example.com', 'Africa/Lagos');

        self::assertSame('October 17, 2026 at 14:05 WAT', $this->moment($user, 'en'));
        self::assertSame('17 octobre 2026 à 14:05 WAT', $this->moment($user, 'fr'));
    }

    /** A zone with no common short name shows its offset. */
    #[Test]
    public function aZoneWithNoShortNameShowsItsOffset(): void
    {
        self::assertSame('October 17, 2026 at 17:05 UTC+04:00', $this->moment($this->registered('dubai@example.com', 'Asia/Dubai'), 'en'));
    }

    #[Test]
    public function anAccountWithNoneGetsUtcLabelled(): void
    {
        self::assertSame('October 17, 2026 at 13:05 UTC', $this->moment($this->registered('nobody@example.com', null), 'en'));
    }

    #[Test]
    public function changingItInSettingsChangesTheNextEmail(): void
    {
        $user = $this->registered('kemi@example.com', 'Africa/Lagos');

        $body = $this->call('PUT', '/api/auth/timezone', ['timezone' => 'Europe/London'], $user);
        self::assertSame(['timezone' => 'Europe/London'], $body);
        self::assertSame(['timezone' => 'Europe/Kyiv'], $this->call('PUT', '/api/auth/timezone', ['timezone' => 'Europe/Kiev'], $user));
        $this->call('PUT', '/api/auth/timezone', ['timezone' => 'Europe/London'], $user);
        self::assertSame('Europe/London', $this->call('GET', '/api/auth/me', null, $user)['timezone']);

        self::service(PasswordChangeMailer::class)->sendChanged($this->fresh($user), new DateTimeImmutable(self::AT), null, null);
        self::assertStringContainsString('14:05 BST', (string) $this->lastMail()->getTextBody());
    }

    #[Test]
    public function anUnknownZoneIsRefusedAndNothingIsSaved(): void
    {
        $user = $this->registered('ade@example.com', 'Africa/Lagos');

        $body = $this->call('PUT', '/api/auth/timezone', ['timezone' => 'Mars/Olympus_Mons'], $user);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations']);
        self::assertSame('timezone', $violations[0]['propertyPath']);
        self::assertSame("That time zone isn't one we know, so nothing was saved. Choose one from the list.", $violations[0]['message']);
        self::assertSame('Africa/Lagos', $this->fresh($user)->getTimezone());
    }

    /** The device's zone at the sign-up's code, and an older account's from its next request that names one. */
    #[Test]
    public function aZoneComesFromTheDevice(): void
    {
        $this->call('POST', '/api/auth/register', ['email' => 'new@example.com', 'name' => 'New', 'password' => self::PASSWORD]);
        $handle = Type\string()->coerce($this->last()['registration']);
        $code = Regex\first_match((string) $this->lastMail()->getTextBody(), '/\b(\d{6})\b/')[1] ?? '';
        $this->call('POST', '/api/auth/register/verify', ['registration' => $handle, 'code' => $code], zone: 'Africa/Nairobi');
        self::assertSame('Africa/Nairobi', $this->byAddress('new@example.com')->getTimezone());

        $chrome = $this->registered('bengaluru@example.com', null);
        $this->call('GET', '/api/auth/me', null, $chrome, zone: 'Asia/Calcutta');
        self::assertSame('Asia/Kolkata', $this->fresh($chrome)->getTimezone(), "Chrome's legacy name, stored by its current one");

        $older = $this->registered('older@example.com', null);
        $this->call('GET', '/api/auth/me', null, $older, zone: 'Not/A_Zone');
        self::assertNull($this->fresh($older)->getTimezone(), 'a zone that is not one stores nothing');
        $this->call('GET', '/api/auth/me', null, $older, zone: 'America/Sao_Paulo');
        self::assertSame('America/Sao_Paulo', $this->fresh($older)->getTimezone());
        $this->call('GET', '/api/auth/me', null, $older, zone: 'Europe/Paris');
        self::assertSame('America/Sao_Paulo', $this->fresh($older)->getTimezone(), 'only Settings changes one already set');
    }

    #[Test]
    public function aPasswordSignInGivesAnOlderAccountItsZone(): void
    {
        $user = $this->registered('signin@example.com', null);

        $this->call('POST', '/api/auth/login', ['email' => 'signin@example.com', 'password' => self::PASSWORD], zone: 'Africa/Accra');

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame('Africa/Accra', $this->fresh($user)->getTimezone());
    }

    /** One row per IANA zone, each with its own city, even where several share an offset. */
    #[Test]
    public function theListHasEveryZoneByItsOwnCity(): void
    {
        $user = $this->registered('list@example.com', null);

        $zones = Type\vec(Type\shape(['id' => Type\string(), 'city' => Type\string(), 'country' => Type\string(), 'offset' => Type\string()]))
            ->coerce($this->call('GET', '/api/auth/timezones', null, $user)['timezones']);
        $byId = static fn (string $id): ?array => Iter\first(Vec\filter($zones, static fn (array $zone): bool => $zone['id'] === $id));

        self::assertSame(['id' => 'Africa/Lagos', 'city' => 'Lagos', 'country' => 'Nigeria', 'offset' => '+01:00'], $byId('Africa/Lagos'), 'no CLDR city: IANA’s');
        self::assertSame('Kinshasa', $byId('Africa/Kinshasa')['city'] ?? null, 'its own row, though it shares an offset');
        self::assertSame('Mexico City', $byId('America/Mexico_City')['city'] ?? null);
        self::assertSame('+01:00', $byId('Europe/London')['offset'] ?? null, "today's offset, summer time included");
    }

    /** sc-986: CLDR's city in the reader's language, IANA's spelling beside it, and tzdata's former names. */
    #[Test]
    public function citiesReadInTheLanguageAndKeepTheirFormerNames(): void
    {
        $user = $this->registered('names@example.com', null);
        $rows = static fn (array $list): array => Type\vec(Type\shape([
            'id' => Type\string(),
            'city' => Type\string(),
            'ianaCity' => Type\string(),
            'formerNames' => Type\vec(Type\string()),
        ], true))->coerce($list['timezones']);
        $fr = $rows($this->call('GET', '/api/auth/timezones', null, $user, language: 'fr'));
        $en = $rows($this->call('GET', '/api/auth/timezones', null, $user, language: 'en'));
        $row = static fn (array $zones, string $id): array => Iter\first(Vec\filter($zones, static fn (array $zone): bool => $zone['id'] === $id)) ?? [];

        self::assertSame(['Londres', 'London'], [$row($fr, 'Europe/London')['city'] ?? null, $row($fr, 'Europe/London')['ianaCity'] ?? null]);
        self::assertSame('Saint-Jean de Terre-Neuve', $row($fr, 'America/St_Johns')['city'] ?? null);
        self::assertSame('St. John’s', $row($en, 'America/St_Johns')['city'] ?? null, 'CLDR’s English, not IANA’s St Johns');
        self::assertSame('Lagos', $row($fr, 'Africa/Lagos')['city'] ?? null, 'no CLDR city: IANA’s');
        self::assertContains('Calcutta', $row($en, 'Asia/Kolkata')['formerNames'] ?? []);
        self::assertContains('Saigon', $row($en, 'Asia/Ho_Chi_Minh')['formerNames'] ?? []);
        self::assertSame([], $row($en, 'America/Argentina/Buenos_Aires')['formerNames'] ?? null, 'a link with the row’s own city is never a former name');

        self::assertSame(['timezone' => 'Asia/Kolkata'], $this->call('PUT', '/api/auth/timezone', ['timezone' => 'Asia/Calcutta'], $user), 'returned as the current id');
        self::assertSame('Asia/Kolkata', $this->fresh($user)->getTimezone(), 'only the current IANA id is ever stored');
    }

    private function moment(User $user, string $locale): string
    {
        return self::service(UserMailer::class)->moment(new DateTimeImmutable(self::AT), $user, $locale);
    }

    private function registered(string $address, ?string $zone): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Someone', self::PASSWORD)->user;
        $user->setTimezone($zone);
        self::onboard($user);

        return $user;
    }

    private function fresh(User $user): User
    {
        self::em()->clear();

        return Type\instance_of(User::class)->coerce(self::em()->find(User::class, $user->getId()));
    }

    private function byAddress(string $address): User
    {
        self::em()->clear();

        return Type\instance_of(User::class)->coerce(self::service(UserRepository::class)->findOneByPrimaryEmailAddress($address));
    }

    private function lastMail(): Email
    {
        return Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null, ?User $as = null, ?string $zone = null, string $language = 'en'): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => null === $as ? '' : 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($as),
            'HTTP_X_TIMEZONE' => $zone ?? '',
            'HTTP_ACCEPT_LANGUAGE' => $language,
        ], content: Json\encode($body ?? new stdClass()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }
}
