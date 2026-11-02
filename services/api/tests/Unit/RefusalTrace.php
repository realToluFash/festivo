<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use Psl\Vec;

final readonly class RefusalTrace
{
    /**
     * @param list<string> $leaves each literal, after where it is written
     * @param list<string> $params each parameter the value is passed in through, as `function#position`
     */
    public function __construct(
        public array $leaves = [],
        public array $params = [],
    ) {
    }

    public function and(self $other): self
    {
        return new self([...$this->leaves, ...$other->leaves], Vec\unique([...$this->params, ...$other->params]));
    }
}
