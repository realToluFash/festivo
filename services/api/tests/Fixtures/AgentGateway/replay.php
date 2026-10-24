<?php

declare(strict_types=1);

use Psl\IO;
use Psl\Regex;

require \dirname(__DIR__, 3) . '/vendor/autoload.php';

$path = (string) \parse_url($_SERVER['REQUEST_URI'], \PHP_URL_PATH);
$match = Regex\first_match($path, '#^/([a-z_]+)/(anthropic|gateway)/v1/messages$#');

if (null === $match) {
    \http_response_code(404);

    return;
}

/** @var array{anthropic: array{status: int, body: mixed}, gateway: array{status: int, headers: array<string, string>, body: mixed}} $pair */
$pair = \json_decode((string) \file_get_contents(__DIR__ . '/' . $match[1] . '.json'), true, flags: \JSON_THROW_ON_ERROR);
$side = $pair[$match[2]];

\http_response_code($side['status']);
\header('content-type: application/json');

foreach ($side['headers'] ?? [] as $name => $value) {
    \header($name . ': ' . $value);
}

// The SDK retries a 5xx twice, honouring retry-after; without it every error case waits seconds.
if ($side['status'] >= 500) {
    \header('retry-after: 0');
}

IO\write(\json_encode($side['body'], \JSON_THROW_ON_ERROR));
