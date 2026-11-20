<?php

declare(strict_types=1);

namespace App\Domain\Organisation\AuditLog;

use App\Audit\Auditor;
use App\Domain\Guest\Export\CsvFile;
use App\Domain\Organisation\Export\PreparedFiles;
use App\Entity\AuditEntry;
use App\Entity\AuditExport;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\AuditExportStatus;
use App\Enum\AuditType;
use App\Enum\ErrorCode;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\AuditEntryRepository;
use App\Repository\AuditExportRepository;
use App\Repository\AuditFilter;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** Export of the filtered entries (sc-611): up to 10,000 at once, up to 1,000,000 prepared and emailed to the person who asked, more refused before anything starts. */
final readonly class AuditExports
{
    public const int AT_ONCE = 10_000;

    public const int AT_MOST = 1_000_000;

    private const int BATCH = 1_000;

    private const array CONTENT_TYPES = ['csv' => 'text/csv; charset=utf-8', 'jsonl' => 'application/x-ndjson'];

    public function __construct(
        private AuditEntryRepository $auditEntryRepository,
        private AuditExportRepository $auditExportRepository,
        private AuditEntryView $auditEntryView,
        private AuditExportMailer $auditExportMailer,
        private PreparedFiles $preparedFiles,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private AfterResponse $afterResponse,
        private LoggerInterface $logger,
        private ClockInterface $clock,
    ) {
    }

    public static function contentType(string $format): string
    {
        return self::CONTENT_TYPES[$format] ?? self::CONTENT_TYPES['csv'];
    }

    /**
     * The file itself for a small export, or the export now being prepared; either way one Audit log entry, with its filters and its row count.
     *
     * @param array<string, string> $filters as asked, for the entry
     */
    public function export(Organisation $organisation, User $by, AuditFilter $filter, array $filters, string $format, string $locale): string|AuditExport
    {
        $described = [] === $filters ? null : $this->described($organisation, $filter, $filters);
        $count = $this->auditEntryRepository->countMatching($filter);

        if ($count > self::AT_MOST) {
            throw new ApiException(ErrorCode::AuditExportTooMany, 'audit.export_too_many', [], null, [], ['count' => $count, 'most' => self::AT_MOST], ['{most}' => self::AT_MOST]);
        }

        if ($count <= self::AT_ONCE) {
            $file = $this->file($filter, $format, $locale);
            $this->audit($organisation, $by, $described, $format, $count);
            $this->entityManager->flush();

            return $file;
        }

        $export = new AuditExport($organisation, $by, $this->clock->now(), $format, $filters, $count, $locale);
        $this->entityManager->persist($export);
        $this->audit($organisation, $by, $described, $format, $count);
        $this->entityManager->flush();
        $this->afterResponse->defer(fn () => $this->prepare($export, $filter->upTo($export->getAskedAt())));

        return $export;
    }

    public function prepare(AuditExport $export, AuditFilter $filter): void
    {
        try {
            $key = Str\format('audit-exports/%s/%s.%s', $export->getOrganisation()->getId()->toRfc4122(), $export->getId()->toRfc4122(), $export->getFormat());
            $this->preparedFiles->keep($key, self::contentType($export->getFormat()), fn ($file) => $this->write($file, $filter, $export->getFormat(), $export->getLocale()));
        } catch (Throwable $e) {
            $this->logger->error('An audit log export failed to prepare.', ['export' => $export->getId()->toRfc4122(), 'exception' => $e::class]);
            $export->setStatus(AuditExportStatus::Failed);
            $this->entityManager->flush();

            return;
        }

        $export->setFileKey($key);
        $export->setReadyAt($this->clock->now());
        $export->setStatus(AuditExportStatus::Ready);
        $this->entityManager->flush();

        try {
            $this->entityManager->getConnection()->transactional(fn () => $this->auditExportMailer->ready($export));
        } catch (Throwable $e) {
            $this->logger->error('An audit log export is ready but its email failed.', ['export' => $export->getId()->toRfc4122(), 'exception' => $e::class]);
        }
    }

    /** The prepared file, for the person who asked, signed in, while they still read the log and for 24 hours from its being ready; anyone else is told it isn't there. */
    public function download(Organisation $organisation, string $exportId, User $by): AuditExport
    {
        $export = $this->preparedFiles->ready($this->auditExportRepository->findOneIn($organisation, $exportId), $by);
        $this->preparedFiles->unexpired($export, 'audit.export_expired');

        return $export;
    }

    /** @param ?array<string, ?string> $filters */
    private function audit(Organisation $organisation, User $by, ?array $filters, string $format, int $count): void
    {
        $this->auditor->record(AuditType::EXPORTED, 'Organisation', $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'format' => [null, $format],
            'filters' => [null, $filters],
            'rows' => [null, $count],
        ]);
    }

    /**
     * @param array<string, string> $filters
     *
     * @return array<string, ?string> the filters as the exporter chose them, a person and an event by the name they had then; one from outside this organisation is refused, never named
     */
    private function described(Organisation $organisation, AuditFilter $filter, array $filters): array
    {
        return Dict\map_with_key($filters, fn (string $field, string $value): ?string => match ($field) {
            'person' => $this->personName($organisation, $filter, $value),
            'event' => $this->eventName($organisation, $filter, $value),
            default => $value,
        });
    }

    /** A member past or present, or someone the log names as acting here: the people the Person filter offers. */
    private function personName(Organisation $organisation, AuditFilter $filter, string $id): string
    {
        $membership = $this->entityManager->getRepository(Membership::class)->findOneBy(['organisation' => $organisation, 'user' => Uuid::fromString($id)]);

        return $membership?->getUser()->getName()
            ?? self::named($this->auditEntryRepository->findPeople($filter), $id)
            ?? throw self::notOffered('person');
    }

    /** An event of this organisation, or one its log names: the events the Event filter offers, those deleted since among them. */
    private function eventName(Organisation $organisation, AuditFilter $filter, string $id): string
    {
        $event = $this->entityManager->getRepository(Event::class)->findOneBy(['organisation' => $organisation, 'id' => Uuid::fromString($id)]);

        return $event?->getName()
            ?? self::named($this->auditEntryRepository->findEvents($filter), $id)
            ?? throw self::notOffered('event');
    }

    /** @param list<array{id: string, name: string}> $offered */
    private static function named(array $offered, string $id): ?string
    {
        return Iter\first(Vec\filter($offered, static fn (array $one): bool => $one['id'] === Uuid::fromString($id)->toRfc4122()))['name'] ?? null;
    }

    private static function notOffered(string $field): ApiException
    {
        return ApiException::validation([['propertyPath' => $field, 'message' => 'audit.invalid_filter', 'code' => 'invalid_choice']]);
    }

    private function file(AuditFilter $filter, string $format, string $locale): string
    {
        $stream = \fopen('php://temp', 'r+') ?: throw new RuntimeException('No memory stream for the audit log export.');
        $this->write($stream, $filter, $format, $locale);
        \rewind($stream);
        $written = \stream_get_contents($stream);
        \fclose($stream);

        return false === $written ? '' : $written;
    }

    /** @param resource $stream */
    private function write($stream, AuditFilter $filter, string $format, string $locale): void
    {
        $columns = AuditEntryView::columns();

        if ('csv' === $format) {
            CsvFile::start($stream);
            \fputcsv($stream, $columns, ',', '"', '', "\r\n");
        }

        $after = null;

        do {
            $entries = $this->auditEntryRepository->findPage($filter, $after, self::BATCH);

            foreach ($this->auditEntryView->exported($locale, ...$entries) as $row) {
                if ('csv' === $format) {
                    CsvFile::row($stream, Vec\map($columns, static fn (string $column): string => $row[$column] ?? ''));
                } else {
                    \fwrite($stream, Json\encode($row) . "\n");
                }
            }

            $last = Iter\last($entries);
            $after = $last instanceof AuditEntry ? [$last->getOccurredAt(), $last->getId()] : null;

            foreach ($entries as $entry) {
                $this->entityManager->detach($entry);
            }
        } while (self::BATCH === Iter\count($entries));
    }
}
