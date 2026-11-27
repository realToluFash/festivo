<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Dispatched whenever sessions end, however they ended, for what a scope keeps per session. */
final readonly class SessionsEnded
{
    /** @var list<Uuid> the refresh chains */
    public array $sessions;

    public function __construct(Uuid ...$sessions)
    {
        $this->sessions = Vec\values($sessions);
    }
}
