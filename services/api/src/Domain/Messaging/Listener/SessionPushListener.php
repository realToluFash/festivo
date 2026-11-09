<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Listener;

use App\Domain\Messaging\PushTargets;
use App\Domain\User\Model\SessionsEnded;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/** Signing out on a device ends its push with its session (sc-3980). */
#[AsEventListener]
final readonly class SessionPushListener
{
    public function __construct(
        private PushTargets $pushTargets,
    ) {
    }

    public function __invoke(SessionsEnded $event): void
    {
        $this->pushTargets->forgetSessions(...$event->sessions);
    }
}
