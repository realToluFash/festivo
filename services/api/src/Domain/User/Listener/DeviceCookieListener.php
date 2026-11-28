<?php

declare(strict_types=1);

namespace App\Domain\User\Listener;

use App\Domain\User\Device\DeviceIdentity;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/** Sets the web's device cookie on the response of a sign-in that asked for it (sc-511). */
#[AsEventListener(event: KernelEvents::RESPONSE)]
final readonly class DeviceCookieListener
{
    public function __invoke(ResponseEvent $event): void
    {
        if ($event->isMainRequest()) {
            DeviceIdentity::attachTo($event->getResponse(), $event->getRequest());
        }
    }
}
