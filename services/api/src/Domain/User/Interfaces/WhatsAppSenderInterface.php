<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

use SensitiveParameter;

interface WhatsAppSenderInterface
{
    /**
     * An authentication-template message carrying the code, in the person's language.
     *
     * @param non-empty-string $to E.164
     *
     * @return string the provider's message id, which its delivery reports name
     */
    public function sendCode(string $to, #[SensitiveParameter] string $code, string $locale): string;
}
