<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

interface TextMessageSenderInterface
{
    /** @param non-empty-string $to E.164 */
    public function send(string $to, string $body): void;
}
