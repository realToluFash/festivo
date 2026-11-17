<?php

declare(strict_types=1);

// A live event with a seating plan, committed so other processes see it, for SeatingRaceTest, which deletes it again; prints its ids and an owner's token as JSON.
// php seat-race-setup.php <seats> <guests' companions, comma separated>

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Kernel;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psl\IO;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

require \dirname(__DIR__, 3) . '/vendor/autoload.php';

[, $seats, $parties] = Type\shape([Type\string(), Type\string(), Type\string()])->coerce($argv);
$_SERVER['APP_ENV'] = 'test';
$_ENV['APP_ENV'] = 'test';
new Dotenv()->bootEnv(\dirname(__DIR__, 3) . '/.env');

$kernel = new Kernel('test', true);
$kernel->boot();
$container = Type\instance_of(Symfony\Component\DependencyInjection\ContainerInterface::class)->coerce($kernel->getContainer()->get('test.service_container'));
$entityManager = Type\instance_of(EntityManagerInterface::class)->coerce($container->get(EntityManagerInterface::class));

$user = Type\instance_of(UserRegistrar::class)->coerce($container->get(UserRegistrar::class))->register('race-' . SecureRandom\string(8) . '@ire.events', 'Person', 'a decent passphrase')->user;
$user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
$user->markDetailsSaved();
$organisation = Type\instance_of(OrganisationFounder::class)->coerce($container->get(OrganisationFounder::class))->found($user, 'Race Events', 'NG', 'Africa/Lagos');
$entityManager->flush();
$token = Type\instance_of(JWTTokenManagerInterface::class)->coerce($container->get(JWTTokenManagerInterface::class))->create($user);

$send = static function (string $method, string $path, ?array $body = null) use ($kernel, $token): array {
    $response = $kernel->handle(Request::create($path, $method, server: [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
    ], content: null === $body ? null : Json\encode($body)));
    $raw = (string) $response->getContent();

    return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
};

$event = Type\shape(['event' => Type\shape(['id' => Type\string()], true)], true)->coerce($send('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
    'name' => 'Race', 'type' => 'wedding', 'startsAt' => '2030-06-12T16:00', 'endsAt' => '2030-06-13T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN',
]))['event']['id'];
$entityManager->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $event]);
$send('POST', '/api/events/' . $event . '/make-live');
$send('POST', '/api/events/' . $event . '/seating-plan', ['widthCm' => 2400, 'lengthCm' => 1800]);
$table = Type\string()->coerce($send('POST', '/api/events/' . $event . '/seating-plan/tables', ['shape' => 'round'])['tableId'] ?? null);
$version = Type\int()->coerce(Type\shape(['seating' => Type\shape(['plan' => Type\shape(['tables' => Type\vec(Type\shape(['version' => Type\int()], true))], true)], true)], true)->coerce($send('GET', '/api/events/' . $event . '/seating-plan'))['seating']['plan']['tables'][0]['version']);
$kernel->handle(Request::create('/api/events/' . $event . '/seating-plan/tables/' . $table, 'PATCH', server: [
    'CONTENT_TYPE' => 'application/json',
    'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
    'HTTP_IF_MATCH' => '"' . $version . '"',
], content: Json\encode(['seats' => (int) $seats])));

$guests = Vec\map(Str\split($parties, ','), static fn (string $companions): string => Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($send('POST', '/api/events/' . $event . '/guests', [
    'fullName' => 'Guest ' . SecureRandom\string(6),
    'companions' => Vec\fill(Type\uint()->coerce((int) $companions), ['fullName' => null]),
]))['guest']['id']);

IO\write(Json\encode(['token' => $token, 'userId' => $user->getId()->toRfc4122(), 'organisationId' => $organisation->getId()->toRfc4122(), 'eventId' => $event, 'tableId' => $table, 'guests' => $guests]));
