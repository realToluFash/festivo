<?php

declare(strict_types=1);

namespace App\Enum;

/** Which client made a request: the app sends its install identifier as a header, a browser keeps the web's cookie (sc-511). */
enum ClientKind: string
{
    case App = 'app';
    case Browser = 'browser';
}
