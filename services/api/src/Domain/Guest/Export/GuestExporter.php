<?php

declare(strict_types=1);

namespace App\Domain\Guest\Export;

use App\Audit\Auditor;
use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\ExportedGuests;
use App\Domain\Guest\Model\GuestNeeds;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\GuestExportFormat;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Enum\NeedKind;
use App\Repository\GuestRepository;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** sc-3784: the client names who is in the file and in what order, so its rows are the dialog's count; the details are read here, from the list as it is now. */
final readonly class GuestExporter
{
    public const string EXPORTED = 'guests.exported';

    private const array NEEDS_COLUMNS = ['allergies' => NeedKind::Allergen, 'diet' => NeedKind::Diet, 'access' => NeedKind::Access];

    public function __construct(
        private GuestRepository $guestRepository,
        private GuestNeedsRecord $guestNeedsRecord,
        private TranslatorInterface $translator,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /**
     * @param list<string> $people ids of the guests and companions in the file, in its order
     * @param 'view'|'all' $scope
     */
    public function export(Event $event, array $people, GuestExportFormat $format, bool $needs, string $scope, User $by): ExportedGuests
    {
        $everybody = Dict\from_entries(Vec\map($this->guestRepository->findOnList($event), static fn (Guest $one): array => [$one->getId()->toRfc4122(), $one]));
        $picked = Vec\map(Vec\filter(Vec\unique($people), static fn (string $id): bool => Iter\contains_key($everybody, $id)), static fn (string $id): Guest => $everybody[$id]);
        $places = Dict\count_values(Vec\filter_nulls(Vec\map($everybody, static fn (Guest $one): ?string => $one->getHost()?->getId()->toRfc4122())));
        $recorded = $needs ? $this->guestNeedsRecord->of($picked) : null;
        $zone = new DateTimeZone($event->getTimeZone());

        $rows = [
            $this->headings($needs),
            ...Vec\map($picked, fn (Guest $person): array => Vec\map(
                $this->row($person, $places, $recorded, $zone),
                SpreadsheetCell::safe(...),
            )),
        ];
        $name = $this->fileName($event, $format, $zone);

        $this->auditor->record(self::EXPORTED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), changes: [
            'rows' => [null, Iter\count($picked)],
            'scope' => [null, $scope],
            'format' => [null, $format->value],
            'needs' => [null, $needs],
            'contacts' => [null, true],
        ]);
        $this->entityManager->flush();

        return new ExportedGuests($name, $format, match ($format) {
            GuestExportFormat::Xlsx => XlsxFile::of($this->translator->trans('guest_export.sheet'), $rows),
            GuestExportFormat::Csv => CsvFile::of($rows),
        });
    }

    /** A slash would make the name a path, so it reads as a dash. */
    private function fileName(Event $event, GuestExportFormat $format, DateTimeZone $zone): string
    {
        $base = $this->translator->trans('guest_export.file', [
            'event' => $event->getName(),
            'day' => $this->clock->now()->setTimezone($zone)->format('Y-m-d'),
        ]);

        return Str\replace_every($base, ['/' => '-', '\\' => '-']) . '.' . $format->value;
    }

    /** @return list<string> */
    private function headings(bool $needs): array
    {
        return Vec\map(
            Vec\filter(
                ['full_name', 'guest_of', 'group', 'reply', 'replied_on', 'email', 'mobile', 'allergies', 'diet', 'access', 'places', 'added_on'],
                static fn (string $column): bool => $needs || !Iter\contains_key(self::NEEDS_COLUMNS, $column),
            ),
            fn (string $column): string => $this->translator->trans('guest_export.column.' . $column),
        );
    }

    /**
     * @param array<string, int>         $places   each host's companions, by the host's id
     * @param ?array<string, GuestNeeds> $recorded everybody's needs by id, or null when the file has no needs columns
     *
     * @return list<string>
     */
    private function row(Guest $person, array $places, ?array $recorded, DateTimeZone $zone): array
    {
        $host = $person->getHost() ?? $person;
        $companion = $host !== $person;
        $reply = $host->getReply() ?? GuestReply::NoReply;
        $repliedAt = GuestReply::NoReply === $reply ? null : $host->getRepliedAt();
        $needs = null === $recorded ? null : $recorded[$person->getId()->toRfc4122()] ?? GuestNeeds::none();

        return [
            $person->getFullName() ?? '',
            $companion ? $host->getFullName() ?? '' : '',
            $host->getGroup()?->getName() ?? '',
            $this->translator->trans('guest_export.reply.' . self::replyKey(GuestStanding::of($reply, $companion, $host->isInvited(), $person->isNotComingByGuest()))),
            null === $repliedAt ? '' : self::day($repliedAt, $zone),
            $companion ? '' : $host->getEmail() ?? '',
            $companion ? '' : $host->getMobile() ?? '',
            ...null === $needs ? [] : Vec\map(Vec\values(self::NEEDS_COLUMNS), fn (NeedKind $kind): string => $this->needWords($needs, $kind)),
            $companion ? '' : (string) (1 + ($places[$host->getId()->toRfc4122()] ?? 0)),
            self::day($host->getCreatedAt(), $zone),
        ];
    }

    private function needWords(GuestNeeds $needs, NeedKind $kind): string
    {
        $other = $needs->otherOf($kind);

        return Str\join(Vec\map(
            $needs->codesOf($kind),
            fn (string $code): string => NeedKind::OTHER === $code && null !== $other
                ? $other
                : $this->translator->trans('guest_export.' . $kind->value . '.' . $code),
        ), ', ');
    }

    private static function replyKey(GuestStanding $standing): string
    {
        return match (true) {
            GuestStanding::NotYetInvited === $standing => 'notYetInvited',
            $standing->isHeld() => 'held',
            GuestStanding::Accepted === $standing => 'coming',
            GuestStanding::Maybe === $standing => 'maybe',
            GuestStanding::Declined === $standing => 'notComing',
            default => 'noReply',
        };
    }

    private static function day(DateTimeImmutable $at, DateTimeZone $zone): string
    {
        return $at->setTimezone($zone)->format('Y-m-d');
    }
}
