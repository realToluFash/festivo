<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Enum\ColourScheme;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use stdClass;

final class AccountColourSchemeTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
    }

    #[Test]
    public function aPersonWhoNeverChoseHasNone(): void
    {
        $user = $this->registered('never@example.com', true);

        $me = $this->call('GET', '/api/auth/me', null, $user);

        self::assertArrayHasKey('colourScheme', $me);
        self::assertNull($me['colourScheme']);
    }

    /** It comes back with the person, so a new device or browser opens in it. */
    #[Test]
    public function aPickIsSavedOnTheAccountAndComesBackWithThePerson(): void
    {
        $user = $this->registered('garden@example.com', true);

        self::assertSame(['colourScheme' => 'garden'], $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => 'garden'], $user));
        self::assertSame(ColourScheme::Garden, $this->fresh($user)->getColourScheme());
        self::assertSame('garden', $this->call('GET', '/api/auth/me', null, $user)['colourScheme']);
    }

    /** Picking Violet saves violet, so a change of default never moves somebody who chose it ("Decided, 7 Nov 2026", 2). */
    #[Test]
    public function violetIsSavedAsAChoiceAndNullAsNone(): void
    {
        $user = $this->registered('violet@example.com', true);

        self::assertSame(['colourScheme' => 'violet'], $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => 'violet'], $user));
        self::assertSame(ColourScheme::Violet, $this->fresh($user)->getColourScheme());

        self::assertSame(['colourScheme' => null], $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => null], $user));
        self::assertNull($this->fresh($user)->getColourScheme());
    }

    #[Test]
    public function aPersonInNoOrganisationPicksToo(): void
    {
        $user = $this->registered('alone@example.com', false);

        self::assertSame(['colourScheme' => 'blacktie'], $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => 'blacktie'], $user));
    }

    #[Test]
    public function anyOtherValueIsRefusedNamingTheFieldAndNothingIsSaved(): void
    {
        $user = $this->registered('refused@example.com', true);
        $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => 'sorbet'], $user);

        foreach (['green', 'Violet', '', 5, ['violet']] as $value) {
            $body = $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => $value], $user);

            self::assertSame(422, $this->client->getResponse()->getStatusCode(), Json\encode($value));
            $violations = Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($body['violations']);
            self::assertSame('colourScheme', $violations[0]['propertyPath'], Json\encode($value));
        }

        $body = $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => 'green'], $user);
        $violations = Type\vec(Type\shape(['message' => Type\string()], true))->coerce($body['violations']);
        self::assertSame("That is not one of Soirely's colour schemes, so nothing was saved. Choose one of the eight.", $violations[0]['message']);
        self::assertSame(ColourScheme::Sorbet, $this->fresh($user)->getColourScheme());
    }

    #[Test]
    public function nobodySignedOutPicks(): void
    {
        $this->call('PUT', '/api/auth/colour-scheme', ['colourScheme' => 'garden']);

        self::assertSame(401, $this->client->getResponse()->getStatusCode());
    }

    private function registered(string $address, bool $withOrganisation): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Someone', self::PASSWORD)->user;
        self::onboard($user, $withOrganisation);

        return $user;
    }

    private function fresh(User $user): User
    {
        self::em()->clear();

        return Type\instance_of(User::class)->coerce(self::em()->find(User::class, $user->getId()));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null, ?User $as = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => null === $as ? '' : 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($as),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: Json\encode($body ?? new stdClass()));

        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }
}
