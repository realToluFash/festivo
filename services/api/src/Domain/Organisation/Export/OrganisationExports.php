<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

use App\Audit\Auditor;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\OrganisationExport;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\OrganisationExportStatus;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationExportRepository;
use App\Storage\ObjectStore;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/** Export all data (sc-612): an Owner asks, the archive is prepared in the background, and only they download it, once, within 24 hours. */
final readonly class OrganisationExports
{
    public const string SUBJECT = 'Organisation';

    public const string ASKED = 'organisation.export_asked';

    public const string DOWNLOADED = 'organisation.export_downloaded';

    /** A try still running is left alone this long before the next run tries again. */
    public const string RETRY_AFTER = 'PT5M';

    private const string CONTENT_TYPE = 'application/zip';

    public function __construct(
        private OrganisationExportRepository $organisationExportRepository,
        private OrganisationArchive $organisationArchive,
        private OrganisationExportMailer $organisationExportMailer,
        private OwnerCheck $ownerCheck,
        private ObjectStore $objectStore,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private AfterResponse $afterResponse,
        private UserMailer $userMailer,
        private LoggerInterface $logger,
        private ClockInterface $clock,
    ) {
    }

    /** Refused `owner_required` for anyone but an Owner, and 429 until 24 hours after the last export that did not fail. */
    public function ask(Organisation $organisation, User $by, ?string $asked): OrganisationExport
    {
        $this->ownerCheck->require($organisation, $by, 'organisation.export_owner_required');

        $export = $this->entityManager->wrapInTransaction(function () use ($organisation, $by): OrganisationExport {
            $this->entityManager->lock($organisation, LockMode::PESSIMISTIC_WRITE);
            $now = $this->clock->now();
            $next = $this->organisationExportRepository->findLatestCountedIn($organisation)?->nextAllowedAt();

            if (null !== $next && $next > $now) {
                $locale = $this->userMailer->answeredFormattingLocale();

                throw ApiException::tooManyAttemptsUntil(
                    'limits.organisation_export',
                    $next,
                    fn (DateTimeImmutable $at): string => $this->userMailer->deadline($at, $by, $locale),
                );
            }

            $export = new OrganisationExport($organisation, $by, $now);
            $this->entityManager->persist($export);
            $this->auditor->record(self::ASKED, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
                'export' => [null, $export->getId()->toRfc4122()],
            ]);
            $this->entityManager->flush();

            return $export;
        });

        $this->afterResponse->defer(fn () => $this->prepare($export, $asked));

        return $export;
    }

    /** One try: the archive kept and its asker emailed, or the try counted and, after the last, Didn't finish. */
    public function prepare(OrganisationExport $export, ?string $asked = null): void
    {
        if (OrganisationExportStatus::Preparing !== $export->getStatus()) {
            return;
        }

        $export->attempting($this->clock->now());
        $this->entityManager->flush();

        try {
            $key = Str\format('organisation-exports/%s/%s.zip', $export->getOrganisation()->getId()->toRfc4122(), $export->getId()->toRfc4122());
            $this->objectStore->keep($key, $this->organisationArchive->of($export->getOrganisation()), self::CONTENT_TYPE);
        } catch (Throwable $e) {
            $this->logger->error('An organisation export failed to prepare.', ['export' => $export->getId()->toRfc4122(), 'attempt' => $export->getAttempts(), 'exception' => $e::class]);
            $export->attemptFailed();
            $this->entityManager->flush();

            return;
        }

        $export->ready($key, $this->clock->now());
        $this->entityManager->flush();

        try {
            $this->entityManager->getConnection()->transactional(fn () => $this->organisationExportMailer->ready($export, $asked));
        } catch (Throwable $e) {
            $this->logger->error('An organisation export is ready but its email failed.', ['export' => $export->getId()->toRfc4122(), 'exception' => $e::class]);
        }
    }

    /** Each export still preparing whose last try has had its time, tried again. */
    public function prepareDue(): int
    {
        $due = $this->organisationExportRepository->findDue($this->clock->now()->sub(new DateInterval(self::RETRY_AFTER)));

        foreach ($due as $export) {
            $this->prepare($export);
        }

        return Iter\count($due);
    }

    /** The archive, once, for the Owner who asked, within 24 hours of its being ready; anyone else is told it isn't there. */
    public function download(Organisation $organisation, string $exportId, User $by): DownloadedArchive
    {
        $export = $this->organisationExportRepository->findOneIn($organisation, $exportId);

        if (null === $export || !$export->isAskedBy($by) || !$this->ownerCheck->holds($organisation, $by)) {
            throw ApiException::notFound('access.not_found');
        }

        $key = $export->getArchiveKey();
        $expiresAt = $export->expiresAt();

        if (OrganisationExportStatus::Ready !== $export->getStatus() || null === $key || null === $expiresAt) {
            throw new ApiException(ErrorCode::ExportNotReady, 'organisation.export_not_ready');
        }

        if (null !== $export->getDownloadedAt()) {
            throw new ApiException(ErrorCode::ExportUsed, 'organisation.export_used');
        }

        $now = $this->clock->now();

        if ($now >= $expiresAt) {
            throw new ApiException(ErrorCode::ExportExpired, 'organisation.export_expired');
        }

        $bytes = $this->objectStore->readKept($key);

        if (!$this->organisationExportRepository->claimDownload($export, $now)) {
            throw new ApiException(ErrorCode::ExportUsed, 'organisation.export_used');
        }

        $this->auditor->record(self::DOWNLOADED, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'export' => [null, $export->getId()->toRfc4122()],
        ]);
        $this->entityManager->flush();

        return new DownloadedArchive(
            Str\format('%s %s.zip', $organisation->getName(), $export->getAskedAt()->format('Y-m-d')),
            $bytes,
        );
    }
}
