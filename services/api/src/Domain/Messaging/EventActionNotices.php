<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Model\ActionNotices;
use App\Domain\Messaging\Model\Notice;
use App\Enum\EventAction;

/** Who hears of each event action (epic 36, 26 Oct, point 4). A new EventAction fails NotificationRegistryTest until somebody decides. */
final readonly class EventActionNotices
{
    public static function for(EventAction $action): ActionNotices
    {
        return match ($action) {
            EventAction::Edit => new ActionNotices(Notice::awaiting('sc-4330'), Notice::awaiting('sc-13214'), Notice::awaiting('sc-4333')),
            EventAction::EditSchedule => new ActionNotices(Notice::awaiting('sc-4330'), Notice::awaiting('sc-13214'), Notice::awaiting('sc-4333')),
            EventAction::Delete => new ActionNotices(Notice::none(), Notice::awaiting('sc-13214'), Notice::none()),
            EventAction::MakeLive => new ActionNotices(Notice::none(), Notice::awaiting('sc-13214'), Notice::none()),
            EventAction::Pause => new ActionNotices(Notice::awaiting('sc-4330'), Notice::awaiting('sc-13214'), Notice::none()),
            EventAction::End => new ActionNotices(Notice::awaiting('sc-4330'), Notice::awaiting('sc-13214'), Notice::awaiting('sc-4333')),
            EventAction::Invite => new ActionNotices(Notice::awaiting('sc-3971'), Notice::none(), Notice::none()),
            EventAction::Message => new ActionNotices(Notice::awaiting('sc-3942'), Notice::none(), Notice::none()),
            EventAction::CheckIn, EventAction::Service => new ActionNotices(Notice::none(), Notice::none(), Notice::none()),
        };
    }
}
