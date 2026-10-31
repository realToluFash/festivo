<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Interfaces\WhatsAppSenderInterface;
use Psl\Iter;
use RuntimeException;
use SensitiveParameter;

/** The suite's stand-in for WhatsApp: what would have been sent, and numbers it refuses outright. */
final class RecordingWhatsAppSender implements WhatsAppSenderInterface
{
    /** @var list<array{to: string, code: string, locale: string, id: string}> */
    public array $sent = [];

    /** @var list<string> */
    public array $refused = [];

    public function sendCode(string $to, #[SensitiveParameter] string $code, string $locale): string
    {
        if (Iter\contains($this->refused, $to)) {
            throw new RuntimeException('WhatsApp refused the message.');
        }

        $id = 'wamid.' . Iter\count($this->sent);
        $this->sent[] = ['to' => $to, 'code' => $code, 'locale' => $locale, 'id' => $id];

        return $id;
    }
}
