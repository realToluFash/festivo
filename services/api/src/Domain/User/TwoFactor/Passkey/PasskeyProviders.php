<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Passkey;

use Psl\File;
use Psl\Json;
use Psl\Type;

/** A provider's name by AAGUID, from passkeydeveloper/passkey-authenticator-aaguids, copied into config. */
final class PasskeyProviders
{
    /** @var array<string, string>|null */
    private ?array $names = null;

    /** @param non-empty-string $listFile */
    public function __construct(
        private readonly string $listFile,
    ) {
    }

    public function nameOf(string $aaguid): ?string
    {
        $this->names ??= Json\typed(File\read($this->listFile), Type\dict(Type\string(), Type\string()));

        return $this->names[$aaguid] ?? null;
    }
}
