<?php

declare(strict_types=1);

// One SMS reserved at an agreed instant, in its own process, for UsageRaceTest; prints held, refused or late.
// php usage-race.php <unix start> <organisation id>

use App\Domain\Billing\Meter\Exception\ReservationRefused;
use App\Domain\Billing\Meter\Model\MeteredUse;
use App\Domain\Billing\Meter\UsageMeter;
use App\Enum\UsageKind;
use App\Kernel;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\IO;
use Psl\Type;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\Uid\Uuid;

require \dirname(__DIR__, 3) . '/vendor/autoload.php';

[, $startAt, $organisation] = Type\shape([Type\string(), Type\string(), Type\string()])->coerce($argv);
$_SERVER['APP_ENV'] = 'test';
$_ENV['APP_ENV'] = 'test';
new Dotenv()->bootEnv(\dirname(__DIR__, 3) . '/.env');

$kernel = new Kernel('test', true);
$kernel->boot();
$container = Type\instance_of(Symfony\Component\DependencyInjection\ContainerInterface::class)->coerce($kernel->getContainer()->get('test.service_container'));
$meter = Type\instance_of(UsageMeter::class)->coerce($container->get(UsageMeter::class));
$use = new MeteredUse(UsageKind::Sms, 1, 'NG');

$wait = Type\float()->coerce($startAt) - \microtime(true);
// Late means staggered, and a staggered pair passes with or without the lock: the test must know.
if ($wait <= 0) {
    IO\write('late');

    exit(0);
}

Async\sleep(Duration::milliseconds((int) ($wait * 1_000)));

try {
    $meter->reserve(Uuid::fromString($organisation), $use);
    IO\write('held');
} catch (ReservationRefused) {
    IO\write('refused');
}
