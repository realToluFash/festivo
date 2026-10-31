<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\EventActionNotices;
use App\Domain\Messaging\Model\Notice;
use App\Domain\Messaging\NotificationRegistry;
use App\Enum\EventAction;
use App\Tests\FunctionalTestCase;
use PHPUnit\Framework\Attributes\Test;
use Psl\Regex;

final class NotificationRegistryTest extends FunctionalTestCase
{
    #[Test]
    public function everyRegisteredTypeHasASenderForEachOfItsChannels(): void
    {
        $registry = self::service(NotificationRegistry::class);

        self::assertNotEmpty($registry->types());

        foreach ($registry->types() as $type) {
            foreach ($type->channels() as $channel) {
                self::assertNotNull($registry->sender($channel), "{$type->name()} offers {$channel->value}, which nothing sends");
            }
        }
    }

    #[Test]
    public function everyEventActionSaysWhatEachAudienceGets(): void
    {
        $registry = self::service(NotificationRegistry::class);

        foreach (EventAction::cases() as $action) {
            $notices = EventActionNotices::for($action);

            foreach (['guests' => $notices->guests, 'members' => $notices->members, 'staff' => $notices->staff] as $audience => $notice) {
                self::assertTrue($this->decided($notice, $registry), "{$action->value} for {$audience} names neither a registered type nor the story that adds one");
            }
        }
    }

    private function decided(Notice $notice, NotificationRegistry $registry): bool
    {
        if (null !== $notice->type) {
            return $registry->has($notice->type);
        }

        return null === $notice->awaiting || null !== Regex\first_match($notice->awaiting, '/^sc-\d+$/');
    }
}
