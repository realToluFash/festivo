<?php

declare(strict_types=1);

namespace App\Http\Listener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\KernelEvents;

/** Ends the response before terminate work: Symfony does so only for FastCGI and LiteSpeed, not FrankenPHP. */
#[AsEventListener(event: KernelEvents::TERMINATE, priority: 4096)]
final class FinishResponseListener
{
    public function __invoke(): void
    {
        if (\function_exists('frankenphp_finish_request')) {
            \frankenphp_finish_request();
        }
    }
}
