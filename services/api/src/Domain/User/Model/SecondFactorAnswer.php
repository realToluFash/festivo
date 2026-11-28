<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use SensitiveParameter;

/** What a step that asks for the second factor was given: one of the app's code, a recovery code, either in one field, or a passkey. */
final readonly class SecondFactorAnswer
{
    /** @param array<string, mixed>|null $passkey the browser's `PublicKeyCredential.toJSON()` */
    public function __construct(
        #[SensitiveParameter]
        public ?string $code = null,
        #[SensitiveParameter]
        public ?string $recoveryCode = null,
        #[SensitiveParameter]
        public ?string $either = null,
        public ?array $passkey = null,
    ) {
    }
}
