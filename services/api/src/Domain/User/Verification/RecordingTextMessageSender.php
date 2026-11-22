<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Interfaces\TextMessageSenderInterface;

/** The suite's stand-in: what would have been texted, kept so a test can read the code. */
final class RecordingTextMessageSender implements TextMessageSenderInterface
{
    /** @var list<array{to: string, body: string}> */
    public array $sent = [];

    public function send(string $to, string $body): void
    {
        $this->sent[] = ['to' => $to, 'body' => $body];
    }
}
