<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Audit\Auditor;
use App\Domain\Organisation\AuditLog\AuditEntryView;
use App\Domain\Organisation\AuditLog\AuditExports;
use App\Domain\Organisation\Export\PreparedFiles;
use App\Domain\User\Mail\UserMailer;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\AuditType;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\AuditEntryRepository;
use App\Repository\AuditExportRepository;
use App\Repository\AuditFilter;
use App\Repository\MembershipRepository;
use App\Repository\OrganisationRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings › Data and control › Audit log (sc-611): read only, for an Owner or an Admin of an Enterprise organisation; a Member is refused, and a free organisation `plan_required`. */
#[InOrganisation(Permission::OrganisationManage, feature: PlanFeature::AuditLog, featureLocksReading: true)]
final readonly class AuditLogController
{
    public const string KEPT_FOR = 'P365D';

    private const int PAGE = 50;

    private const string DAY = '/^\d{4}-\d{2}-\d{2}$/';

    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private AuditEntryRepository $auditEntryRepository,
        private AuditExportRepository $auditExportRepository,
        private MembershipRepository $membershipRepository,
        private AuditEntryView $auditEntryView,
        private AuditExports $auditExports,
        private PreparedFiles $preparedFiles,
        private UserMailer $userMailer,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/audit-log', name: 'orgs_audit_log', methods: ['GET'])]
    public function list(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $user = $this->user();
        $asked = Input::query($request, Type\shape([
            'person' => Type\optional(Type\string()),
            'type' => Type\optional(Type\string()),
            'event' => Type\optional(Type\string()),
            'from' => Type\optional(Type\string()),
            'to' => Type\optional(Type\string()),
            'before' => Type\optional(Type\string()),
        ]));
        $filter = $this->filter($organisation, $user, $asked);
        $entries = $this->auditEntryRepository->findPage($filter, self::cursor($asked['before'] ?? null), self::PAGE + 1);
        $more = Iter\count($entries) > self::PAGE;
        $entries = Vec\take($entries, self::PAGE);
        $last = Iter\last($entries);
        $everything = new AuditFilter($organisation->getId(), $filter->since);

        return new JsonResponse([
            'organisation' => $organisation->getName(),
            'zone' => $user->getTimezone(),
            'entries' => $this->auditEntryView->shown($user, $this->userMailer->formattingLocaleFor($user), ...$entries),
            'next' => $more && $last instanceof AuditEntry ? Str\format('%s_%s', $last->getOccurredAt()->format('Y-m-d\TH:i:s'), $last->getId()->toRfc4122()) : null,
            'people' => $this->people($organisation, $everything),
            'events' => $this->events($everything),
            'preparing' => null === $this->auditExportRepository->findPreparingFor($organisation, $user) ? null : $user->getPrimaryEmailAddress()?->getAddress(),
        ]);
    }

    #[Route('/api/orgs/{organisationId}/audit-log/views', name: 'orgs_audit_log_viewed', methods: ['POST'])]
    public function viewed(string $organisationId): Response
    {
        $organisation = $this->organisation($organisationId);
        $user = $this->user();
        $this->auditor->record(AuditType::VIEWED, 'Organisation', $organisation->getId(), Actor::User, $user->getId(), $user->getName());
        $this->entityManager->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/orgs/{organisationId}/audit-log/exports', name: 'orgs_audit_log_export', methods: ['POST'])]
    public function export(Request $request, string $organisationId): Response
    {
        $organisation = $this->organisation($organisationId);
        $user = $this->user();
        $body = Input::body($request, Type\shape([
            'format' => Type\union(Type\literal_scalar('csv'), Type\literal_scalar('jsonl')),
            'person' => Type\optional(Type\string()),
            'type' => Type\optional(Type\string()),
            'event' => Type\optional(Type\string()),
            'from' => Type\optional(Type\string()),
            'to' => Type\optional(Type\string()),
        ]));
        $format = $body['format'];
        $asked = Dict\filter(Dict\filter_nulls(['person' => $body['person'] ?? null, 'type' => $body['type'] ?? null, 'event' => $body['event'] ?? null, 'from' => $body['from'] ?? null, 'to' => $body['to'] ?? null]), static fn (string $value): bool => '' !== $value);
        $filter = $this->filter($organisation, $user, $asked);
        $locale = $this->userMailer->localeFor($user, $request->getLocale());
        $exported = $this->auditExports->export($organisation, $user, $filter, $asked, $format, $locale);

        if (\is_string($exported)) {
            return new Response($exported, Response::HTTP_OK, PreparedFiles::headers(AuditExports::contentType($format), $this->fileName($organisation, $this->clock->now(), $format, $locale), 'audit-log.' . $format));
        }

        return new JsonResponse([
            'id' => $exported->getId()->toRfc4122(),
            'count' => $exported->getEntries(),
            'email' => $user->getPrimaryEmailAddress()?->getAddress(),
        ], Response::HTTP_ACCEPTED);
    }

    #[Route('/api/orgs/{organisationId}/audit-log/exports/{exportId}/download', name: 'orgs_audit_log_export_download', methods: ['POST'])]
    public function download(Request $request, string $organisationId, string $exportId): Response
    {
        $organisation = $this->organisation($organisationId);
        $user = $this->user();
        $export = $this->auditExports->download($organisation, $exportId, $user);
        $format = $export->getFormat();
        $name = $this->fileName($organisation, $export->getAskedAt(), $format, $this->userMailer->localeFor($user, $request->getLocale()));

        return $this->preparedFiles->response($this->preparedFiles->chunks($export), AuditExports::contentType($format), $name, 'audit-log.' . $format);
    }

    private function fileName(Organisation $organisation, DateTimeImmutable $askedAt, string $format, string $locale): string
    {
        return $this->translator->trans('audit.export_file', [
            'organisation' => $organisation->getName(),
            'day' => $askedAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d'),
        ], 'messages', $locale) . '.' . $format;
    }

    /** @param array<string, string> $asked person, type, event, from, to and before; the dates are days in the reader's zone */
    private function filter(Organisation $organisation, User $user, array $asked): AuditFilter
    {
        $zone = new DateTimeZone($user->getTimezone() ?? 'UTC');
        $utc = new DateTimeZone('UTC');
        $from = $this->day($asked['from'] ?? null, 'from', $zone);
        $to = $this->day($asked['to'] ?? null, 'to', $zone);

        if (null !== $from && null !== $to && $from > $to) {
            throw ApiException::validation([['propertyPath' => 'to', 'message' => 'audit.dates_backwards', 'code' => 'dates_backwards']]);
        }

        $type = $asked['type'] ?? null;

        return new AuditFilter(
            $organisation->getId(),
            $this->clock->now()->setTimezone($utc)->sub(new DateInterval(self::KEPT_FOR)),
            $this->uuid($asked['person'] ?? null, 'person'),
            null === $type ? null : AuditType::tryFrom($type) ?? throw ApiException::validation([['propertyPath' => 'type', 'message' => 'audit.invalid_filter', 'code' => 'invalid_choice']]),
            $this->uuid($asked['event'] ?? null, 'event'),
            $from?->setTimezone($utc),
            $to?->modify('+1 day')->setTimezone($utc),
        );
    }

    private function day(?string $day, string $field, DateTimeZone $zone): ?DateTimeImmutable
    {
        if (null === $day || '' === $day) {
            return null;
        }

        $parsed = Regex\matches($day, self::DAY) ? DateTimeImmutable::createFromFormat('!Y-m-d', $day, $zone) : false;

        return false === $parsed || $parsed->format('Y-m-d') !== $day ? throw ApiException::validation([['propertyPath' => $field, 'message' => 'audit.invalid_filter', 'code' => 'invalid_date']]) : $parsed;
    }

    private function uuid(?string $id, string $field): ?Uuid
    {
        if (null === $id || '' === $id) {
            return null;
        }

        return Uuid::isValid($id) ? Uuid::fromString($id) : throw ApiException::validation([['propertyPath' => $field, 'message' => 'audit.invalid_filter', 'code' => 'invalid_choice']]);
    }

    /** @return ?array{0: DateTimeImmutable, 1: Uuid} */
    private static function cursor(?string $before): ?array
    {
        if (null === $before) {
            return null;
        }

        $parts = Str\split($before, '_');
        $at = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s', $parts[0], new DateTimeZone('UTC'));

        if (2 !== Iter\count($parts) || false === $at || !Uuid::isValid($parts[1])) {
            throw ApiException::validation([['propertyPath' => 'before', 'message' => 'audit.invalid_filter', 'code' => 'invalid_choice']]);
        }

        return [$at, Uuid::fromString($parts[1])];
    }

    /** @return list<array{id: string, name: string, email: ?string, left: bool}> by name, those who have left among them */
    private function people(Organisation $organisation, AuditFilter $everything): array
    {
        $found = $this->auditEntryRepository->findPeople($everything);
        $active = Dict\from_keys(Vec\map($this->membershipRepository->findActiveIn($organisation), static fn (Membership $membership): string => $membership->getUser()->getId()->toRfc4122()), static fn (): bool => true);
        $emails = $this->emails(Vec\map($found, static fn (array $person): string => $person['id']));

        return Vec\sort_by(
            Vec\map($found, static fn (array $person): array => [
                'id' => $person['id'],
                'name' => $person['name'],
                'email' => $emails[$person['id']] ?? null,
                'left' => !Iter\contains_key($active, $person['id']),
            ]),
            static fn (array $person): string => Str\lowercase($person['name']),
        );
    }

    /** @return list<array{id: string, name: string, gone: bool}> */
    private function events(AuditFilter $everything): array
    {
        $found = $this->auditEntryRepository->findEvents($everything);
        $ids = Vec\map($found, static fn (array $event): string => $event['id']);
        $live = [] === $ids ? [] : Dict\from_keys(Type\vec(Type\string())->coerce($this->entityManager->getConnection()->fetchFirstColumn(
            'SELECT id::text FROM events WHERE id::text IN (:ids) AND deleted_at IS NULL',
            ['ids' => $ids],
            ['ids' => ArrayParameterType::STRING],
        )), static fn (): bool => true);

        return Vec\sort_by(
            Vec\map($found, static fn (array $event): array => ['id' => $event['id'], 'name' => $event['name'], 'gone' => !Iter\contains_key($live, $event['id'])]),
            static fn (array $event): string => Str\lowercase($event['name']),
        );
    }

    /**
     * @param list<string> $ids
     *
     * @return array<string, string>
     */
    private function emails(array $ids): array
    {
        if ([] === $ids) {
            return [];
        }

        $rows = Type\vec(Type\shape(['id' => Type\string(), 'address' => Type\string()]))->coerce($this->entityManager->getConnection()->fetchAllAssociative(
            'SELECT u.id::text AS id, e.address FROM users u JOIN email_addresses e ON e.user_id = u.id AND e.is_primary WHERE u.id::text IN (:ids) AND u.deleted_at IS NULL',
            ['ids' => $ids],
            ['ids' => ArrayParameterType::STRING],
        ));

        return Dict\pull($rows, static fn (array $row): string => $row['address'], static fn (array $row): string => $row['id']);
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
