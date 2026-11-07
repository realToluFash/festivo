<?php

declare(strict_types=1);

namespace App\Tests\Fixtures\Crash;

use Psl\Str;
use Symfony\Component\ErrorHandler\Error\OutOfMemoryError;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/** Answering an out-of-memory crash takes memory the request has used up, as the profiler does in dev. */
#[AsEventListener(event: KernelEvents::EXCEPTION, priority: 1024)]
final class HungryCrashAnswer
{
    public function __invoke(ExceptionEvent $event): void
    {
        if (!$event->getThrowable() instanceof OutOfMemoryError) {
            return;
        }

        $event->getRequest()->attributes->set('_crash_answer', Str\repeat('x', 8 * 1_048_576));
    }
}
