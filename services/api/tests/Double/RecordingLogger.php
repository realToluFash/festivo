<?php

declare(strict_types=1);

namespace App\Tests\Double;

use Psr\Log\AbstractLogger;
use Stringable;

final class RecordingLogger extends AbstractLogger
{
    /** @var list<array{level: mixed, message: string}> */
    public array $records = [];

    /** @var list<array<array-key, mixed>> each record's context, in the same order */
    public array $contexts = [];

    /** @param array<array-key, mixed> $context */
    public function log(mixed $level, string|Stringable $message, array $context = []): void
    {
        $this->records[] = ['level' => $level, 'message' => (string) $message];
        $this->contexts[] = $context;
    }
}
