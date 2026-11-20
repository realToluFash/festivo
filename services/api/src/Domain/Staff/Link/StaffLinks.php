<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use App\Audit\Auditor;
use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\StaffRosterPublisher;
use App\Entity\Event;
use App\Entity\StaffLinkToken;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Enum\StaffLinkStatus;
use App\Http\Exception\ApiException;
use App\Http\LinkTokens;
use App\Repository\StaffLinkTokenRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Encoding\Base64;
use Psl\SecureRandom;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Each person's own link (sc-3912). Every delivery issues its own 128-bit token, kept only as its SHA-256, and none ends another; Replace link and removal end them all. How far the link got lives on the person, and only moves forward.
 */
final readonly class StaffLinks
{
    public const string ISSUED = 'staff.link_issued';

    public const string MARKED_SENT = 'staff.link_marked_sent';

    public const string REPLACED = 'staff.link_replaced';

    public const string PATH = '/w/';

    private const int TOKEN_BYTES = 16;

    private const string OPENS_BEFORE = '-12 hours';

    private const string ENDS_AFTER = '+2 hours';

    public function __construct(
        private string $webOrigin,
        private EntityManagerInterface $entityManager,
        private StaffLinkTokenRepository $staffLinkTokenRepository,
        private StaffShiftRepository $staffShiftRepository,
        private StaffRosterPublisher $staffRosterPublisher,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /**
     * The link with its plain token, returned once and never kept. A copy or share on a row reading No link yet, Copied or Shared records it; on one reading Link sent or Link opened the row stays as it is.
     */
    public function deliver(StaffMember $entry, bool $shared, User $by): string
    {
        if (null === $entry->getMobile()) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('staff.link_needs_mobile'));
        }

        $token = Base64\encode(SecureRandom\bytes(self::TOKEN_BYTES), Base64\Variant::UrlSafe, padding: false);

        $this->entityManager->wrapInTransaction(function () use ($entry, $shared, $by, $token): void {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $this->entityManager->persist(new StaffLinkToken($entry, LinkTokens::hash($token)));

            if (!$entry->getLinkStatus()->delivered()) {
                $entry->linkMoved($shared ? StaffLinkStatus::Shared : StaffLinkStatus::Copied, $by, $this->clock->now());
            }

            $this->audit(self::ISSUED, $entry, $by);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($entry->getEvent());

        return $this->webOrigin . self::PATH . $token;
    }

    /** Only after a copy or share; Link sent and Link opened stay as they are. */
    public function markSent(StaffMember $entry, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($entry, $by): void {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);

            if (StaffLinkStatus::Copied === $entry->getLinkStatus() || StaffLinkStatus::Shared === $entry->getLinkStatus()) {
                $entry->linkMoved(StaffLinkStatus::Sent, $by, $this->clock->now());
                $this->audit(self::MARKED_SENT, $entry, $by);
                $this->entityManager->flush();
            }
        });

        $this->staffRosterPublisher->publish($entry->getEvent());
    }

    /** Ends every link the person was given, and the row reads No link yet again. */
    public function replace(StaffMember $entry, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($entry, $by): void {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $this->staffLinkTokenRepository->endAllOf($entry);
            $entry->linkMoved(StaffLinkStatus::None, null, null);
            $this->audit(self::REPLACED, $entry, $by);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($entry->getEvent());
    }

    /** Unknown, replaced and removed tokens all come back null from the one lookup by hash. */
    public function find(#[SensitiveParameter] string $token): ?StaffMember
    {
        return $this->staffLinkTokenRepository->findOneByTokenHash(LinkTokens::hash($token))?->getStaffMember();
    }

    /** Recorded by the page once it is visible, never by a fetch, and only inside the window. */
    public function opened(StaffMember $entry): void
    {
        if (!$this->window($entry)->open || StaffLinkStatus::Opened === $entry->getLinkStatus()) {
            return;
        }

        $this->entityManager->wrapInTransaction(function () use ($entry): void {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $entry->linkMoved(StaffLinkStatus::Opened, null, $this->clock->now());
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($entry->getEvent());
    }

    /** From 12 hours before their first shift starts until 2 hours after their last one ends, and never once the event has finished. */
    public function window(StaffMember $entry): StaffLinkWindow
    {
        $event = $entry->getEvent();
        $now = $this->clock->now();
        $shifts = $this->staffShiftRepository->findOfPerson($entry);

        if ([] === $shifts || $this->finished($event, $now)) {
            return StaffLinkWindow::ended();
        }

        $starts = Vec\map($shifts, static fn (StaffShift $shift): DateTimeImmutable => ShiftClock::instant($shift->getStartsAt(), $event));
        $ends = Vec\map($shifts, static fn (StaffShift $shift): DateTimeImmutable => ShiftClock::instant($shift->getEndsAt(), $event));
        $from = \min($starts)->modify(self::OPENS_BEFORE);
        $until = \max($ends)->modify(self::ENDS_AFTER);

        return match (true) {
            $now < $from => StaffLinkWindow::notYet($from, $until),
            $now >= $until => StaffLinkWindow::ended(),
            default => StaffLinkWindow::open($until),
        };
    }

    /**
     * Everyone on the event holding a link not yet ended, for the access list (sc-71).
     *
     * @param list<StaffMember> $staff
     *
     * @return list<array{entry: StaffMember, until: DateTimeImmutable}>
     */
    public function live(Event $event, array $staff): array
    {
        $holders = $this->staffLinkTokenRepository->holdersOn($event);
        $live = [];

        foreach ($staff as $entry) {
            $until = isset($holders[$entry->getId()->toRfc4122()]) ? $this->window($entry)->until : null;

            if (null !== $until) {
                $live[] = ['entry' => $entry, 'until' => $until];
            }
        }

        return $live;
    }

    private function finished(Event $event, DateTimeImmutable $now): bool
    {
        return EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
    }

    private function audit(string $action, StaffMember $entry, User $by): void
    {
        $this->auditor->record($action, 'StaffMember', $entry->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
