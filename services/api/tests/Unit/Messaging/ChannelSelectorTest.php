<?php

declare(strict_types=1);

namespace App\Tests\Unit\Messaging;

use App\Domain\Messaging\ChannelSelector;
use App\Domain\Messaging\ProductDefaultPreferences;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;

final class ChannelSelectorTest extends TestCase
{
    private const array ALL = [NotificationChannel::InApp, NotificationChannel::Push, NotificationChannel::Email];

    #[Test]
    public function aMemberGetsWhatTheirCategoryAllows(): void
    {
        self::assertSame([NotificationChannel::InApp, NotificationChannel::Email, NotificationChannel::Push], $this->select(NotificationCategory::EventChanges, self::ALL));
        self::assertSame([NotificationChannel::InApp, NotificationChannel::Push], $this->select(NotificationCategory::EventDay, self::ALL));
    }

    #[Test]
    public function accountAndSecurityEmailCannotBeSwitchedOff(): void
    {
        self::assertSame([NotificationChannel::InApp, NotificationChannel::Email], $this->select(NotificationCategory::AccountSecurity, self::ALL));
    }

    #[Test]
    public function pushIsNeverTheOnlyWaySomebodyHears(): void
    {
        self::assertSame([], $this->select(NotificationCategory::EventDay, [NotificationChannel::Push, NotificationChannel::Email]));
        self::assertSame([NotificationChannel::Email, NotificationChannel::Push], $this->select(NotificationCategory::Money, [NotificationChannel::Push, NotificationChannel::Email]));
    }

    #[Test]
    public function aGuestIsNeverSentPush(): void
    {
        self::assertSame(
            [NotificationChannel::Email],
            new ChannelSelector(new ProductDefaultPreferences())->select(NotificationAudienceKind::Guest, Uuid::v7(), NotificationCategory::Messages, [NotificationChannel::Push, NotificationChannel::Email]),
        );
    }

    /**
     * @param non-empty-list<NotificationChannel> $offered
     *
     * @return list<NotificationChannel>
     */
    private function select(NotificationCategory $category, array $offered): array
    {
        return new ChannelSelector(new ProductDefaultPreferences())->select(NotificationAudienceKind::Member, Uuid::v7(), $category, $offered);
    }
}
