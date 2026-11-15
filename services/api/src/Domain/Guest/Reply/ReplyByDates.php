<?php

declare(strict_types=1);

namespace App\Domain\Guest\Reply;

use App\Domain\Event\Model\ReplyDeadline;
use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Replies close, at the end of the event's Reply by (sc-3780). It keeps the stored day, even when a save closed replies earlier. */
final readonly class ReplyByDates implements MilestoneSourceInterface
{
    public const string KEY = 'replies.close';

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    public function milestones(Event $event): array
    {
        $deadline = ReplyDeadline::of($event);

        if (null === $deadline) {
            return [];
        }

        return [new Milestone(self::KEY, $deadline->closesAt(), $this->translator->trans('timeline.replies_close'), null, MilestoneOwner::Automatic, PermissionArea::Guests)];
    }
}
