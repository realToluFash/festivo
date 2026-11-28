<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Interfaces\TextMessageSenderInterface;
use Psl\Iter;
use Psl\Str;

/** The suite's stand-in: what would have been texted, kept so a test can read the code. */
final class RecordingTextMessageSender implements TextMessageSenderInterface
{
    /** @var list<array{to: string, body: string, statusCallback: string|null}> */
    public array $sent = [];

    public function send(string $to, string $body, ?string $statusCallback = null): ?string
    {
        $this->sent[] = ['to' => $to, 'body' => $body, 'statusCallback' => $statusCallback];

        return 'SM' . Str\pad_left((string) Iter\count($this->sent), 32, '0');
    }
}
