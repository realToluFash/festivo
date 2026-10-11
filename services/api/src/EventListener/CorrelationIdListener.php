<?php

declare(strict_types=1);

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Uid\Uuid;

/**
 * Gives every request an id, and puts it where both a log reader and a caller
 * can find it.
 *
 * Accepted from the caller when they send one, so a trace survives the hop from
 * the mobile app to here; generated when they do not. Without this, "it failed
 * at about four o'clock" is the entire report you get.
 */
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

        // An id from outside is only trusted if it looks like one. Anything
        // else would let a caller write arbitrary text into every log line of
        // the request, which is log injection with extra steps.
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
        if (is_string($id)) {
            $event->getResponse()->headers->set(self::HEADER, $id);
        }
    }
}
