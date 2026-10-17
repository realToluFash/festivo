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

        $older = $this->registered('older@example.com', null);
        $this->call('GET', '/api/auth/me', null, $older, zone: 'Not/A_Zone');
        self::assertNull($this->fresh($older)->getTimezone(), 'a zone that is not one stores nothing');
        $this->call('GET', '/api/auth/me', null, $older, zone: 'America/Sao_Paulo');
        self::assertSame('America/Sao_Paulo', $this->fresh($older)->getTimezone());
        $this->call('GET', '/api/auth/me', null, $older, zone: 'Europe/Paris');
        self::assertSame('America/Sao_Paulo', $this->fresh($older)->getTimezone(), 'only Settings changes one already set');
    }

    /** One row per IANA zone, each with its own city, even where several share an offset. */
    #[Test]
    public function theListHasEveryZoneByItsOwnCity(): void
    {
        $user = $this->registered('list@example.com', null);

        $zones = Type\vec(Type\shape(['id' => Type\string(), 'city' => Type\string(), 'country' => Type\string(), 'offset' => Type\string()]))
            ->coerce($this->call('GET', '/api/auth/timezones', null, $user)['timezones']);
        $byId = static fn (string $id): ?array => Iter\first(Vec\filter($zones, static fn (array $zone): bool => $zone['id'] === $id));

        self::assertSame(['id' => 'Africa/Lagos', 'city' => 'Lagos', 'country' => 'Nigeria', 'offset' => '+01:00'], $byId('Africa/Lagos'));
        self::assertSame('Kinshasa', $byId('Africa/Kinshasa')['city'] ?? null, 'its own row, though it shares an offset');
        self::assertSame('Mexico City', $byId('America/Mexico_City')['city'] ?? null);
        self::assertSame('+01:00', $byId('Europe/London')['offset'] ?? null, "today's offset, summer time included");
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
    private function call(string $method, string $path, ?array $body = null, ?User $as = null, ?string $zone = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => null === $as ? '' : 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($as),
            'HTTP_X_TIMEZONE' => $zone ?? '',
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
