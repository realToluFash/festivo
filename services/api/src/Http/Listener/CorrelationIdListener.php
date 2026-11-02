<?php

declare(strict_types=1);

namespace App\Http\Listener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Uid\Uuid;

#[AsEventListener(event: KernelEvents::REQUEST, priority: 4096)]
#[AsEventListener(event: KernelEvents::RESPONSE, priority: -4096)]
final class CorrelationIdListener
{
    public const HEADER = 'X-Correlation-Id';
    public const ATTRIBUTE = '_correlation_id';

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $incoming = $request->headers->get(self::HEADER);

        $id = null !== $incoming && Uuid::isValid($incoming)
            ? $incoming
            : Uuid::v4()->toRfc4122();

        $request->attributes->set(self::ATTRIBUTE, $id);
    }

    public function onKernelResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $id = $event->getRequest()->attributes->get(self::ATTRIBUTE);
        if (\is_string($id)) {
            $event->getResponse()->headers->set(self::HEADER, $id);
        }
    }
}
