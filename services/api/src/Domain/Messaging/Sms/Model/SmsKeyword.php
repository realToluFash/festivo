<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms\Model;

use App\Enum\SmsKeywordAction;

/** A keyword a text held, and the language it was written in, where the word itself says one. */
final readonly class SmsKeyword
{
    public function __construct(
        public SmsKeywordAction $action,
        public ?string $language = null,
    ) {
    }
}
