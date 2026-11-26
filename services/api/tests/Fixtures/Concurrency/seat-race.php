<?php

declare(strict_types=1);

// One Seat at an agreed instant, in its own process, for SeatingRaceTest; prints the status code and the problem's type.
// php seat-race.php <unix start> <token> <event id> <table id> <guest id> <seat, or 0 for the table>

use App\Kernel;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\IO;
use Psl\Json;
use Psl\Type;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

require \dirname(__DIR__, 3) . '/vendor/autoload.php';

[, $startAt, $token, $event, $table, $guest, $seat] = Type\shape([Type\string(), Type\string(), Type\string(), Type\string(), Type\string(), Type\string(), Type\string()])->coerce($argv);
$_SERVER['APP_ENV'] = 'test';
$_ENV['APP_ENV'] = 'test';
new Dotenv()->bootEnv(\dirname(__DIR__, 3) . '/.env');

$kernel = new Kernel('test', true);
$kernel->boot();

$wait = Type\float()->coerce($startAt) - \microtime(true);
// Late means staggered, and staggered requests pass with or without the keys: the test must know.
if ($wait <= 0) {
    IO\write('late');

    exit(0);
}

Async\sleep(Duration::milliseconds((int) ($wait * 1_000)));

$response = $kernel->handle(Request::create('/api/events/' . $event . '/seating-plan/guests/seat', 'POST', server: [
    'CONTENT_TYPE' => 'application/json',
    'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
], content: Json\encode(['guestId' => $guest, 'kind' => 'table', 'placeId' => $table, 'seat' => '0' === $seat ? null : (int) $seat])));

$type = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $response->getContent()))['type'] ?? '';
IO\write($response->getStatusCode() . ' ' . Type\string()->coerce($type));
