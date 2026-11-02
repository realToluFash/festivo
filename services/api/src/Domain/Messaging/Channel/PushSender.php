<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Channel;

use App\Domain\Messaging\Exception\Unreachable;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Interfaces\PushServiceInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Messaging\PushTargets;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Psl\Str;
use RuntimeException;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;
use Symfony\Component\Uid\Uuid;

/** Every live device the member registered (sc-3980). Fails, to be retried, only when no device took it: the retry goes to all again, and the collapse key replaces rather than stacks. */
final readonly class PushSender implements ChannelSenderInterface
{
    /** @var array<string, PushServiceInterface> */
    private array $services;

    /** @param iterable<PushServiceInterface> $services */
    public function __construct(
        private PushTargets $pushTargets,
        #[AutowireIterator(PushServiceInterface::TAG)]
        iterable $services,
    ) {
        $byKind = [];

        foreach ($services as $service) {
            $byKind[$service->kind()->value] = $service;
        }

        $this->services = $byKind;
    }

    public function channel(): NotificationChannel
    {
        return NotificationChannel::Push;
    }

    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification, ?string $collapseKey = null): ?string
    {
        $targets = $this->pushTargets->of($recipient->id);

        if ([] === $targets) {
            throw new Unreachable('No device takes push.');
        }

        $sent = [];
        $refused = [];

        foreach ($targets as $target) {
            $service = $this->services[$target->kind->value] ?? null;

            if (null === $service) {
                $refused[] = Str\format('Nothing sends %s push.', $target->kind->value);

                continue;
            }

            try {
                $providerId = $service->push($target, $category, $notification, $collapseKey);
            } catch (RuntimeException $refusal) {
                $refused[] = $refusal->getMessage();

                continue;
            }

            if (null === $providerId) {
                $this->pushTargets->forget($target->id);
            } else {
                $sent[] = $providerId;
            }
        }

        if ([] !== $sent) {
            return Str\join($sent, ' ');
        }

        if ([] === $refused) {
            throw new Unreachable('Every device it was registered on has gone.');
        }

        throw new RuntimeException(Str\join($refused, ' '));
    }
}
