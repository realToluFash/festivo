<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Address\Model\Address;
use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedAddressProvider;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Json;
use Psl\Type;

/** The answers the clients' tests read too (packages/api-client), so a renamed key fails here rather than silently there. */
final class AddressesTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $organiser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->organiser = self::service(UserRegistrar::class)->register('organiser@ire.events', 'Person', self::PASSWORD)->user;
        self::onboard($this->organiser, withOrganisation: false);
        self::service(ScriptedAddressProvider::class)->publish('node:3589', new Address(
            'Ozumba Mbadiwe Avenue, Victoria Island, Lagos, Nigeria',
            'Ozumba Mbadiwe Avenue',
            'Victoria Island',
            'Lagos',
            'Lagos State',
            '101241',
            'NG',
            6.4316,
            3.4246,
        ));
    }

    #[Test]
    public function aSuggestionServesItsTextInTwoParts(): void
    {
        self::assertSame(self::answers()['suggest'], $this->data('/api/addresses/suggest?q=Ozumba'));
    }

    #[Test]
    public function twoPlacesThatReadTheSameAreSuggestedOnce(): void
    {
        $provider = self::service(ScriptedAddressProvider::class);
        $provider->publish('way:1', new Address('Praça do Comércio, Lisboa, Portugal'));
        $provider->publish('way:2', new Address('Praça do Comércio, Lisboa, Portugal'));
        $provider->publish('way:3', new Address('Praça do Comércio, Coimbra, Portugal'));

        self::assertSame([
            ['id' => 'way:1', 'text' => 'Praça do Comércio', 'secondary_text' => 'Lisboa, Portugal'],
            ['id' => 'way:3', 'text' => 'Praça do Comércio', 'secondary_text' => 'Coimbra, Portugal'],
        ], $this->data('/api/addresses/suggest?q=Comércio'));
    }

    #[Test]
    public function aPickedAddressServesItsPartsAndItsTimeZone(): void
    {
        self::assertSame(self::answers()['resolve'], $this->data('/api/addresses/node:3589'));
    }

    /** @return array{suggest: mixed, resolve: mixed} */
    private static function answers(): array
    {
        return Type\shape(['suggest' => Type\mixed(), 'resolve' => Type\mixed()])
            ->coerce(Json\decode(File\read(\dirname(__DIR__) . '/Fixtures/Address/lookup-answers.json')));
    }

    private function data(string $path): mixed
    {
        $this->client->request('GET', $path, server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->organiser),
        ]);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());

        return Type\shape(['success' => Type\literal_scalar(true), 'data' => Type\mixed()])
            ->coerce(Json\decode((string) $this->client->getResponse()->getContent()))['data'];
    }
}
