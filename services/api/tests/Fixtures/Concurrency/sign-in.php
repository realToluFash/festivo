<?php

declare(strict_types=1);

// One sign-in in its own process at an agreed instant, for SignInConcurrencyTest; prints the status code.
// php sign-in.php <unix start> <email> <client ip> <redis namespace>

use App\Kernel;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\IO;
use Psl\Json;
use Psl\Type;
use Symfony\Component\Cache\Adapter\RedisAdapter;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

require \dirname(__DIR__, 3) . '/vendor/autoload.php';

const WRONG = 'not the password at all';

[, $startAt, $email, $ip, $namespace] = Type\shape([Type\string(), Type\string(), Type\string(), Type\string(), Type\string()])->coerce($argv);
$_SERVER['APP_ENV'] = 'test';
$_ENV['APP_ENV'] = 'test';
new Dotenv()->bootEnv(\dirname(__DIR__, 3) . '/.env');

// Debug, as PHPUnit boots it: a non-debug container is never rebuilt when the code changes.
$kernel = new Kernel('test', true);
$kernel->boot();
$container = Type\instance_of(Symfony\Component\DependencyInjection\ContainerInterface::class)->coerce($kernel->getContainer()->get('test.service_container'));
// The budgets every process here shares, as Redis is shared by every API container in production.
$container->set('cache.rate_limiter', new RedisAdapter(Type\instance_of(Redis::class)->coerce($container->get('Redis')), $namespace));

$wait = Type\float()->coerce($startAt) - \microtime(true);
// Late means staggered, and staggered attempts pass with or without the lock: the test must know.
if ($wait <= 0) {
    IO\write('late');

    exit(0);
}

Async\sleep(Duration::milliseconds((int) ($wait * 1_000)));

$response = $kernel->handle(Request::create('/api/auth/login', 'POST', server: [
    'CONTENT_TYPE' => 'application/json',
    'REMOTE_ADDR' => $ip,
], content: Json\encode(['email' => $email, 'password' => WRONG])));

IO\write((string) $response->getStatusCode());
