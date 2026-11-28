<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Domain\Messaging\PushTargets;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Psl\Dict;
use Symfony\Component\Uid\Uuid;

/** Who a change notice can reach (sc-4333): signed in to the app with notifications allowed, on the phone and in their own Event day switch. The send, the roster's inApp and the removal question all read this one test. */
final readonly class ShiftNoticeReach
{
    public function __construct(
        private PushTargets $pushTargets,
        private NotificationPreferencesInterface $notificationPreferences,
    ) {
    }

    /** @return array<string, true> by the account's id */
    public function of(Uuid ...$accounts): array
    {
        return Dict\filter_keys(
            $this->pushTargets->inApp(...$accounts),
            fn (string $id): bool => $this->notificationPreferences->allows(Uuid::fromString($id), NotificationCategory::EventDay, NotificationChannel::Push),
        );
    }
}
