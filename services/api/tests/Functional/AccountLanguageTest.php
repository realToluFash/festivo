<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TwoFactor\TwoFactorMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Type;
use stdClass;
use Symfony\Component\Mime\Email;

/** sc-852: the account remembers its language, and every email follows it, with or without a request. */
final class AccountLanguageTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string NEW_PASSWORD = 'a brand new passphrase';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    #[Test]
    public function aFrenchSignUpGetsFrenchEmailWithNoRequestInFlight(): void
    {
        $this->call('POST', '/api/auth/register', ['email' => 'amelie@example.com', 'name' => 'Amélie', 'password' => self::PASSWORD], language: 'fr');
        $handle = Type\string()->coerce($this->last()['registration']);
        $code = Regex\first_match((string) $this->lastMail()->getTextBody(), '/\b(\d{6})\b/')[1] ?? '';
        $this->call('POST', '/api/auth/register/verify', ['registration' => $handle, 'code' => $code], language: 'en');

        $user = $this->account('amelie@example.com');
        self::assertSame('fr', $user->storedLanguage(), 'the language it was started in, not the one the code came from');

        // No request behind it at all: the account's language is all there is to go on.
        self::service(TwoFactorMailer::class)->sendTurnedOff($user, new DateTimeImmutable());
        self::assertStringContainsString('désactivée', (string) $this->lastMail()->getSubject());
    }

    #[Test]
    public function switchingToPortugueseChangesTheNextEmailAndEveryDevice(): void
    {
        $user = $this->registered('folake@example.com', 'en');

        $this->call('PUT', '/api/auth/locale', ['locale' => 'pt'], $user);
        self::assertSame(['locale' => 'pt'], $this->last());

        self::assertSame('pt', $this->call('GET', '/api/auth/me', null, $user, language: 'en')['locale'], 'a second device opens in it');

        $this->call('POST', '/api/auth/login', ['email' => 'folake@example.com', 'password' => self::PASSWORD], language: 'en');
        $session = Type\shape(['accessToken' => Type\string(), 'sessionId' => Type\string()], true)->coerce($this->last());
        $this->client->request('PATCH', '/api/auth/password', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $session['accessToken'],
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: Json\encode(['currentPassword' => self::PASSWORD, 'newPassword' => self::NEW_PASSWORD, 'sessionId' => $session['sessionId']]));

        self::assertSame('A sua palavra-passe da Soirely foi alterada', $this->lastMail()->getSubject(), "the account's language beats the request's");
    }

    #[Test]
    public function anAccountWithNoneTakesTheLanguageItIsNextAskedIn(): void
    {
        $user = $this->registered('old@example.com', 'en');
        $user->setLocale(null);
        self::em()->flush();

        $this->call('GET', '/api/auth/me', null, $user, language: 'es');

        self::assertSame('es', $this->account('old@example.com')->storedLanguage());
    }

    /** The default a request falls back to is not a choice: storing it would pin the person to English. */
    #[Test]
    public function aRequestThatNamesNoLanguageLeavesTheAccountEmpty(): void
    {
        $user = $this->registered('quiet@example.com', 'en');
        $user->setLocale(null);
        self::em()->flush();

        $this->call('GET', '/api/auth/me', null, $user);
        self::assertNull($this->account('quiet@example.com')->storedLanguage(), 'no Accept-Language, nothing stored');

        $this->call('GET', '/api/auth/me', null, $this->account('quiet@example.com'), language: 'de');
        self::assertNull($this->account('quiet@example.com')->storedLanguage(), 'a language outside the four is not one either');

        $this->call('GET', '/api/auth/me', null, $this->account('quiet@example.com'), language: 'fr-FR,fr;q=0.9');
        self::assertSame('fr', $this->account('quiet@example.com')->storedLanguage(), 'and a later one that names French is kept');
    }

    #[Test]
    public function aLanguageOutsideTheFourIsRefused(): void
    {
        $user = $this->registered('folake@example.com', 'en');

        $this->call('PUT', '/api/auth/locale', ['locale' => 'de'], $user);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame('locale', $this->last()['violations'][0]['propertyPath'] ?? null);
        self::assertSame('en', $this->account('folake@example.com')->storedLanguage());
    }

    #[Test]
    #[DataProvider('locales')]
    public function thePasswordChangedEmailIsInTheAccountsLanguage(string $locale, string $subject): void
    {
        $user = $this->registered("in-{$locale}@example.com", $locale);
        $this->call('POST', '/api/auth/login', ['email' => "in-{$locale}@example.com", 'password' => self::PASSWORD]);
        $session = Type\shape(['accessToken' => Type\string(), 'sessionId' => Type\string()], true)->coerce($this->last());
        $this->client->request('PATCH', '/api/auth/password', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $session['accessToken'],
        ], content: Json\encode(['currentPassword' => self::PASSWORD, 'newPassword' => self::NEW_PASSWORD, 'sessionId' => $session['sessionId']]));

        self::assertSame($subject, $this->lastMail()->getSubject(), $user->getId()->toRfc4122());
    }

    /** @return iterable<string, array{string, string}> */
    public static function locales(): iterable
    {
        yield 'en' => ['en', 'Your Soirely password was changed'];
        yield 'es' => ['es', 'Se cambió su contraseña de Soirely'];
        yield 'fr' => ['fr', 'Votre mot de passe Soirely a été modifié'];
        yield 'pt' => ['pt', 'A sua palavra-passe da Soirely foi alterada'];
    }

    private function registered(string $address, string $locale): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Someone', self::PASSWORD)->user;
        $user->setLocale($locale);
        self::onboard($user);

        return $user;
    }

    private function account(string $address): User
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
    private function call(string $method, string $path, ?array $body = null, ?User $as = null, ?string $language = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => null === $as ? '' : 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($as),
            // The test client asks for en-us by default; a request that names no language must really name none.
            'HTTP_ACCEPT_LANGUAGE' => $language ?? '',
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
