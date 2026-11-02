<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use stdClass;

final class AccountNameTest extends ApiTestCase
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
    public function aChangeTrimsTheEndsKeepsTheInsideAndIsAudited(): void
    {
        $user = $this->registered('kemi@example.com', 'Kemi');

        self::assertSame(['name' => 'Kemi  Adé'], $this->call('PUT', '/api/auth/name', ['name' => '  Kemi  Adé '], $user));
        self::assertSame('Kemi  Adé', $this->call('GET', '/api/auth/me', null, $user)['name']);
        self::assertSame([['action' => 'name.changed', 'actor' => 'Kemi', 'changes' => ['name' => ['Kemi', 'Kemi  Adé']]]], $this->audited($user));
    }

    #[Test]
    public function anyNameAPersonHasSavesAsTyped(): void
    {
        $user = $this->registered('zoe@example.com', 'Zoe');

        foreach (["Zoë O'Brien-Núñez", '李小龍', Str\repeat('a', User::NAME_MAXIMUM)] as $name) {
            self::assertSame(['name' => $name], $this->call('PUT', '/api/auth/name', ['name' => $name], $user));
            self::assertSame($name, $this->fresh($user)->getName());
        }
    }

    #[Test]
    public function theSameNameAgainChangesAndRecordsNothing(): void
    {
        $user = $this->registered('ade@example.com', 'Ade Bello');

        self::assertSame(['name' => 'Ade Bello'], $this->call('PUT', '/api/auth/name', ['name' => ' Ade Bello  '], $user));
        self::assertSame([], $this->audited($user));
    }

    #[Test]
    public function aBlankOrTooLongNameIsRefusedOnNameAndNothingIsSaved(): void
    {
        $user = $this->registered('blank@example.com', 'Folake');

        foreach (['   ' => 'Enter your name.', Str\repeat('é', User::NAME_MAXIMUM + 1) => 'Shorten your name to 180 characters or fewer.'] as $typed => $message) {
            $body = $this->call('PUT', '/api/auth/name', ['name' => $typed], $user);

            self::assertSame(422, $this->client->getResponse()->getStatusCode());
            $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations']);
            self::assertSame([['propertyPath' => 'name', 'message' => $message]], Vec\map($violations, static fn (array $v): array => ['propertyPath' => $v['propertyPath'], 'message' => $v['message']]));
        }

        self::assertSame('Folake', $this->fresh($user)->getName());
        self::assertSame([], $this->audited($user));
    }

    #[Test]
    public function signedOutItIsRefusedAndOnlyTheCallersNameChanges(): void
    {
        $user = $this->registered('own@example.com', 'Own Name');
        $other = $this->registered('other@example.com', 'Other Name');

        $this->call('PUT', '/api/auth/name', ['name' => 'Taken Over'], null);
        self::assertSame(401, $this->client->getResponse()->getStatusCode());

        $this->call('PUT', '/api/auth/name', ['name' => 'Renamed'], $user);
        self::assertSame('Renamed', $this->fresh($user)->getName());
        self::assertSame('Other Name', $this->fresh($other)->getName());
    }

    #[Test]
    public function theDetailsScreenTakesTheSameLimit(): void
    {
        $user = $this->registered('details@example.com', 'Person');

        $body = $this->call('PATCH', '/api/auth/complete-profile', ['name' => Str\repeat('a', User::NAME_MAXIMUM + 1)], $user);

        self::assertSame(422, $this->client->getResponse()->getStatusCode());
        self::assertSame(['name'], \array_column(Type\vec(Type\dict(Type\string(), Type\string()))->coerce($body['violations']), 'propertyPath'));
        self::assertSame('Person', $this->fresh($user)->getName());
    }

    /** @return list<array{action: string, actor: ?string, changes: array<string, mixed>}> */
    private function audited(User $user): array
    {
        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['subjectId' => $user->getId(), 'action' => 'name.changed'], ['occurredAt' => 'ASC', 'id' => 'ASC']);

        return Vec\map($entries, static fn (AuditEntry $entry): array => ['action' => $entry->getAction(), 'actor' => $entry->getActorLabel(), 'changes' => $entry->getChanges()]);
    }

    private function registered(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user);

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
    private function call(string $method, string $path, ?array $body, ?User $as): array
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
