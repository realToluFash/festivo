<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\FunctionalTestCase;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Command\Command;

final class CrontabTest extends FunctionalTestCase
{
    #[Test]
    public function everyPruneRunsOnceADay(): void
    {
        $application = new Application(self::$kernel ?? throw new LogicException('No kernel.'));
        $prunes = Vec\sort(Vec\filter(
            Vec\filter_nulls(Vec\map($application->all('app'), static fn (Command $command): ?string => $command->getName())),
            static fn (string $name): bool => Str\starts_with($name, 'app:prune-'),
        ));

        $scheduled = Vec\sort(Vec\filter_nulls(Vec\map(
            Str\split(File\read(__DIR__ . '/../../config/crontab'), "\n"),
            static fn (string $line): ?string => Regex\first_match(
                $line,
                '/^\d{1,2} \d{1,2} \* \* \* php \/app\/bin\/console (app:prune-[a-z-]+) --no-interaction$/',
            )[1] ?? null,
        )));

        self::assertNotEmpty($prunes);
        self::assertSame($prunes, $scheduled);
    }

    #[Test]
    public function theMailRateCheckRunsEveryHour(): void
    {
        $application = new Application(self::$kernel ?? throw new LogicException('No kernel.'));

        self::assertTrue($application->has('app:mail:check-rates'));
        self::assertContains(
            '15 * * * * php /app/bin/console app:mail:check-rates --no-interaction',
            Str\split(File\read(__DIR__ . '/../../config/crontab'), "\n"),
        );
    }
}
