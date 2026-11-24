<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;
use Psl\Vec;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\ConsoleEvents;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Service\ResetInterface;
use Throwable;

/** At most one usage update a second per organisation, and one after the last change (sc-3929). A change only marks it, so a write never waits on the hub. */
#[AsEventListener(event: KernelEvents::TERMINATE, method: 'flush')]
#[AsEventListener(event: ConsoleEvents::TERMINATE, method: 'flush')]
final class UsagePublisher implements ResetInterface
{
    /** @var array<string, Uuid> by organisation id */
    private array $pending = [];

    public function __construct(
        private readonly RealtimePublisher $realtimePublisher,
        private readonly UsageReader $usageReader,
        private readonly RateLimiterFactoryInterface $usageUpdateLimiter,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function changed(Uuid $organisationId): void
    {
        $this->pending[$organisationId->toRfc4122()] = $organisationId;
    }

    /** Each organisation whose second has passed, now; the others stay marked for the next call or the flush. */
    public function publishDue(): void
    {
        foreach ($this->pending as $id => $organisationId) {
            if ($this->usageUpdateLimiter->create($id)->consume()->isAccepted()) {
                unset($this->pending[$id]);
                $this->publish($organisationId);
            }
        }
    }

    /** The trailing update, once each organisation's second has passed, so an open page never stays behind once a send ends. */
    public function flush(): void
    {
        $pending = Vec\values($this->pending);
        $this->pending = [];

        foreach ($pending as $organisationId) {
            $this->usageUpdateLimiter->create($organisationId->toRfc4122())->reserve()->wait();
            $this->publish($organisationId);
        }
    }

    /** The notification worker resets between steps, so a long send publishes as it goes rather than only at its end. */
    public function reset(): void
    {
        $this->publishDue();
    }

    private function publish(Uuid $organisationId): void
    {
        try {
            $this->realtimePublisher->publish(RealtimeTopic::OrganisationUsage, $organisationId->toRfc4122(), $this->usageReader->read($organisationId)->written());
        } catch (Throwable $e) {
            $this->logger->warning('A usage update was dropped; an open page catches up on its next read.', ['organisationId' => $organisationId->toRfc4122(), 'exception' => $e::class]);
        }
    }
}
