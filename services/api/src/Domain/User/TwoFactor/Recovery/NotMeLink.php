<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Entity\TwoFactorRecovery;
use Psl\Str;
use SensitiveParameter;

/** "This wasn't me" in every email about a request: signed with the app secret, so nothing has to be stored to check it. */
final readonly class NotMeLink
{
    public function __construct(
        #[SensitiveParameter]
        private string $secret,
        private string $webOrigin,
    ) {
    }

    public function url(TwoFactorRecovery $recovery): string
    {
        return Str\trim_right($this->webOrigin, '/') . '/two-factor/not-me?request=' . $recovery->getId()->toRfc4122() . '&token=' . $this->token($recovery->getId()->toRfc4122());
    }

    public function matches(string $requestId, #[SensitiveParameter] string $token): bool
    {
        return \hash_equals($this->token($requestId), $token);
    }

    private function token(string $requestId): string
    {
        return \hash_hmac('sha256', 'two-factor-recovery-not-me:' . $requestId, $this->secret);
    }
}
