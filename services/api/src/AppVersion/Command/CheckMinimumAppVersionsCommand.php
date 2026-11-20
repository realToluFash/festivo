<?php

declare(strict_types=1);

namespace App\AppVersion\Command;

use App\AppVersion\MinimumAppVersions;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** bin/docker-entrypoint runs it before the server: a malformed minimum throws while this is built, so the API never starts with it. */
#[AsCommand(
    name: 'app:minimum-app-versions:check',
    description: 'Fail, naming the setting, when MINIMUM_APP_VERSION_IOS or MINIMUM_APP_VERSION_ANDROID is not a version',
)]
final readonly class CheckMinimumAppVersionsCommand
{
    public function __construct(
        private MinimumAppVersions $minimumAppVersions,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format(
            'Minimum app versions: iOS %s, Android %s.',
            $this->minimumAppVersions->ios ?? 'none',
            $this->minimumAppVersions->android ?? 'none',
        ));

        return Command::SUCCESS;
    }
}
