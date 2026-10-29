<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\PushTargetKind;
use SensitiveParameter;

/** One live device as a push service reaches it. The address lets its holder send, so nothing quotes it. */
final readonly class PushTarget
{
    public function __construct(
        public string $id,
        public PushTargetKind $kind,
        #[SensitiveParameter]
        public string $address,
        public ?string $publicKey,
        #[SensitiveParameter]
        public ?string $authSecret,
    ) {
    }
}
