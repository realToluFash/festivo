<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

interface TextMessageSenderInterface
{
    /**
     * @param non-empty-string      $to             E.164
     * @param non-empty-string|null $statusCallback where the provider reports the message's progress
     *
     * @return string|null the provider's id for the message, when it gave one
     */
    public function send(string $to, string $body, ?string $statusCallback = null): ?string;
}
