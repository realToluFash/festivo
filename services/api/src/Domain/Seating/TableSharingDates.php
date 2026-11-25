<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Entity\Event;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use App\Repository\TableSharingRepository;
use DateTimeImmutable;
use DateTimeZone;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The seating milestone a saved Share by adds, owner You (sc-4022): "Share tables" at the end of that day until the tables are shared, then "Tables shared" when they were. One key for both, so a subscribed calendar moves the entry. */
final readonly class TableSharingDates implements MilestoneSourceInterface
{
    public const string KEY = 'seating.share_tables';

    public function __construct(
        private TableSharingRepository $tableSharingRepository,
        private TranslatorInterface $translator,
    ) {
    }

    public function milestones(Event $event): array
    {
        $sharing = $this->tableSharingRepository->findOneForEvent($event);
        $shareBy = $sharing?->getShareBy();

        if (null === $sharing || null === $shareBy) {
            return [];
        }

        $sharedAt = $sharing->getSharedAt();

        if (null !== $sharedAt) {
            return [new Milestone(self::KEY, $sharedAt, $this->translator->trans('timeline.tables_shared'), null, MilestoneOwner::You, PermissionArea::Seating, done: true)];
        }

        $endOfDay = new DateTimeImmutable($shareBy->format('Y-m-d') . ' 23:59:59', new DateTimeZone($event->getTimeZone()));

        return [new Milestone(self::KEY, $endOfDay, $this->translator->trans('timeline.share_tables'), null, MilestoneOwner::You, PermissionArea::Seating)];
    }
}
