<?php

declare(strict_types=1);

namespace App\Http;

use Psl\Iter;
use Symfony\Component\Runtime\Internal\SymfonyErrorHandler;

/** The runtime's error handler (composer.json, extra.runtime): Symfony's, and a request PHP dies on answers in the error shape. */
final class FatalErrorHandler
{
    private const int HEADROOM_BYTES = 64 * 1024 * 1024;

    public static function register(bool $debug): void
    {
        // Ahead of Symfony's, which renders the 500: shutdown functions run in the order registered.
        \register_shutdown_function(self::makeRoom(...));
        SymfonyErrorHandler::register($debug);

        if (Iter\contains(['cli', 'phpdbg', 'embed'], \PHP_SAPI)) {
            return;
        }

        // @mago-expect lint:no-ini-set the runtime turns display on in debug, and PHP's page would go out ahead of the 500
        \ini_set('display_errors', '0');
        // @mago-expect lint:no-ini-set PHP's own line is the record of a crash the kernel could not log
        \ini_set('log_errors', '1');
    }

    private static function makeRoom(): void
    {
        $error = \error_get_last();
        // @mago-expect lint:psl-string-functions nothing may allocate before the limit is raised, and Psl may not be loaded yet
        if (null === $error || !\str_starts_with($error['message'], 'Allowed memory size')) {
            return;
        }

        // @mago-expect lint:no-ini-set the request's memory is still held, and the 500 needs more than Symfony's 32 KB reserve
        \ini_set('memory_limit', (string) (\memory_get_usage(true) + self::HEADROOM_BYTES));
    }
}
