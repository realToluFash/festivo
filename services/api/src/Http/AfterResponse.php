<?php

declare(strict_types=1);

namespace App\Http;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Contracts\Service\ResetInterface;
use Throwable;

/** The one place for work the client must not wait for; it runs once FinishResponseListener has ended the response. */
#[AsEventListener(event: KernelEvents::TERMINATE, method: 'run')]
final class AfterResponse implements ResetInterface
{
    /** @var list<callable(): void> */
    private array $deferred = [];

    public function __construct(
        private readonly LoggerInterface $logger,
    ) {
    }

    /** @param callable(): void $work */
    public function defer(callable $work): void
    {
        $this->deferred[] = $work;
    }

    public function run(): void
    {
        $deferred = $this->deferred;
        $this->deferred = [];

        foreach ($deferred as $work) {
            try {
                $work();
            } catch (Throwable $e) {
                // The class alone: a message here could carry the address the work was for.
                $this->logger->error('Work deferred past the response failed.', ['exception' => $e::class]);
            }
        }
    }

    public function reset(): void
    {
        $this->deferred = [];
    }
}
