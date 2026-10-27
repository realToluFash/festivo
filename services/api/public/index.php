<?php

declare(strict_types=1);

use App\Kernel;

require_once \dirname(__DIR__) . '/vendor/autoload_runtime.php';

return static function (array $context) {
    // The runtime turns PHP's own error display on in debug. On a fatal error that page is
    // written before the error handler runs, sending 200 and the server's paths ahead of the
    // 500 the handler renders (sc-16890).
    \ini_set('display_errors', '0');

    return new Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);
};
