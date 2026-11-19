<?php

declare(strict_types=1);

namespace App\Domain\Organisation\EmailDomains;

use App\Audit\Auditor;
use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\DomainJoining\DomainNameNormaliser;
use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\DomainJoining\PublicMailDomains;
use App\Domain\Organisation\Interfaces\TxtRecordLookupInterface;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\DomainRefusal;
use App\Enum\ErrorCode;
use App\Enum\PlanFeature;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use App\Repository\OrganisationDomainRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\SecureRandom;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Email domains (sc-560): proved by the TXT lookup an owner claim makes (sc-6640), with a value of its own that a claim's never matches. */
final readonly class EmailDomains
{
    public const string SUBJECT = 'Organisation';
    public const string ADDED = 'email_domain.added';
    public const string PROVED = 'email_domain.proved';
    public const string FAILED = 'email_domain.failed';
    public const string MISSING = 'email_domain.record_missing';
    public const string LAPSED = 'email_domain.lapsed';
    public const string REMOVED = 'email_domain.removed';

    public const string LOOK_EVERY = 'PT1H';

    private const string RECORD_PREFIX = '_soirely-verify.';
    private const string VALUE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

    public function __construct(
        private EmailDomainRepository $emailDomainRepository,
        private OrganisationDomainRepository $organisationDomainRepository,
        private ProvedDomains $provedDomains,
        private TxtRecordLookupInterface $txtRecordLookup,
        private EmailDomainMailer $emailDomainMailer,
        private Entitlements $entitlements,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    public static function recordName(string $domain): string
    {
        return self::RECORD_PREFIX . $domain;
    }

    /** @return 'waiting'|'proved'|'failed'|'missing' */
    public static function statusOf(EmailDomain $domain, DateTimeImmutable $now): string
    {
        return match (true) {
            null !== $domain->getMissingSince() => 'missing',
            $domain->isProved() => 'proved',
            null !== $domain->getFailedAt() || $now >= $domain->checksEndAt() => 'failed',
            default => 'waiting',
        };
    }

    public function mayChange(Organisation $organisation): bool
    {
        return $this->entitlements->of($organisation->getId())->unlocks(PlanFeature::EmailDomains);
    }

    public function add(Organisation $organisation, User $by, string $typed): EmailDomain
    {
        $domain = DomainNameNormaliser::normalise($typed);
        $refusal = $this->refusal($organisation, $domain);

        if (null !== $refusal) {
            throw ApiException::validation([[
                'propertyPath' => 'domain',
                'message' => $this->message($refusal, $by, $domain),
                'code' => $refusal->value,
            ]]);
        }

        $added = new EmailDomain($organisation, $domain, SecureRandom\string(32, self::VALUE_ALPHABET), $this->clock->now());
        $this->entityManager->persist($added);
        $this->record(self::ADDED, $added, $by, ['domain' => [null, $domain]]);
        $this->entityManager->flush();

        return $added;
    }

    /** Looks the record up now: true once it is proved, false while the record cannot be found. */
    public function verify(Organisation $organisation, User $by, string $domain): bool
    {
        $emailDomain = $this->emailDomainRepository->findOneInOrganisation($organisation, DomainNameNormaliser::normalise($domain))
            ?? throw ApiException::notFound($this->translator->trans('email_domains.not_listed'));

        if ($this->provedDomains->isProvedElsewhere($emailDomain->getDomain(), $organisation)) {
            throw $this->taken();
        }

        $now = $this->clock->now();

        if (!$this->isPublished($emailDomain)) {
            $this->entityManager->wrapInTransaction(function () use ($emailDomain, $now): void {
                $this->entityManager->refresh($emailDomain, LockMode::PESSIMISTIC_WRITE);
                $emailDomain->checked($now);
                $this->entityManager->flush();
            });

            return false;
        }

        try {
            $this->entityManager->wrapInTransaction(function () use ($emailDomain, $now, $by): void {
                $this->entityManager->refresh($emailDomain, LockMode::PESSIMISTIC_WRITE);
                $this->found($emailDomain, $now, $by);
                $this->entityManager->flush();
            });
        } catch (UniqueConstraintViolationException) {
            throw $this->taken();
        }

        return true;
    }

    public function remove(Organisation $organisation, User $by, string $domain): void
    {
        $emailDomain = $this->emailDomainRepository->findOneInOrganisation($organisation, DomainNameNormaliser::normalise($domain))
            ?? throw ApiException::notFound($this->translator->trans('email_domains.not_listed'));

        $this->record(self::REMOVED, $emailDomain, $by, [
            'domain' => [$emailDomain->getDomain(), null],
            'status' => [self::statusOf($emailDomain, $this->clock->now()), null],
        ]);
        $this->entityManager->remove($emailDomain);
        $this->entityManager->flush();
    }

    /** @return int how many were looked up; each fails or lapses as of its own instant, and one off Enterprise is left as it was */
    public function checkDue(): int
    {
        $moved = 0;

        foreach ($this->emailDomainRepository->findDue($this->clock->now(), self::LOOK_EVERY) as $due) {
            if (!$this->mayChange($due->getOrganisation())) {
                continue;
            }

            $published = $this->isPublished($due);
            $moved += $this->entityManager->wrapInTransaction(function () use ($due, $published): int {
                $this->entityManager->refresh($due, LockMode::PESSIMISTIC_WRITE);
                $changed = $this->settle($due, $published, $this->clock->now());
                $this->entityManager->flush();

                return $changed ? 1 : 0;
            });
        }

        return $moved;
    }

    private function settle(EmailDomain $domain, bool $published, DateTimeImmutable $now): bool
    {
        if ($domain->isProved()) {
            return $this->settleProved($domain, $published, $now);
        }

        if (null !== $domain->getFailedAt()) {
            return false;
        }

        if ($published && $now < $domain->checksEndAt() && !$this->provedDomains->isProvedElsewhere($domain->getDomain(), $domain->getOrganisation())) {
            $this->found($domain, $now, null);

            return true;
        }

        if ($now >= $domain->checksEndAt()) {
            $domain->fail($domain->checksEndAt());
            $this->record(self::FAILED, $domain, null, ['status' => ['waiting', 'failed']], $domain->checksEndAt());

            return true;
        }

        $domain->checked($now);

        return true;
    }

    private function settleProved(EmailDomain $domain, bool $published, DateTimeImmutable $now): bool
    {
        $putBackBy = $domain->putBackBy();

        if (null !== $putBackBy && $now >= $putBackBy) {
            $domain->lapse($putBackBy);
            $this->record(self::LAPSED, $domain, null, ['status' => ['missing', 'failed']], $putBackBy);

            return true;
        }

        if ($published) {
            $domain->found($now);

            return true;
        }

        if (null === $domain->getMissingSince()) {
            $domain->missing($now);
            $this->record(self::MISSING, $domain, null, ['status' => ['proved', 'missing']], $now);
            $this->emailDomainMailer->recordGone($domain);

            return true;
        }

        $domain->checked($now);

        return true;
    }

    /** Proved now: every other organisation whose joining listing of it stops is told, once. */
    private function found(EmailDomain $domain, DateTimeImmutable $now, ?User $by): void
    {
        $wasProved = $domain->isProved();
        $domain->found($now);

        if ($wasProved) {
            return;
        }

        $this->record(self::PROVED, $domain, $by, ['status' => ['waiting', 'proved']], $now);
        $this->entityManager->flush();

        foreach ($this->organisationDomainRepository->findListings($domain->getDomain()) as $listing) {
            if (!$listing->getOrganisation()->getId()->equals($domain->getOrganisation()->getId())) {
                $this->emailDomainMailer->listingStopped($listing->getOrganisation(), $domain);
            }
        }
    }

    private function isPublished(EmailDomain $domain): bool
    {
        return Iter\contains($this->txtRecordLookup->lookUp(self::recordName($domain->getDomain())), $domain->getRecordValue());
    }

    /** sc-63's two checks first, the ones the form makes too; then the server's. */
    private function refusal(Organisation $organisation, string $domain): ?DomainRefusal
    {
        return match (true) {
            '' === $domain => DomainRefusal::Blank,
            !DomainNameNormaliser::isHostname($domain) => DomainRefusal::Invalid,
            PublicMailDomains::includes($domain) => DomainRefusal::Public,
            $this->provedDomains->isProvedElsewhere($domain, $organisation) => DomainRefusal::Taken,
            null !== $this->emailDomainRepository->findOneInOrganisation($organisation, $domain) => DomainRefusal::Listed,
            default => null,
        };
    }

    private function message(DomainRefusal $refusal, User $by, string $domain): string
    {
        $example = ['{example}' => JoinOfferFinder::domainFor($by) ?? 'example.com'];

        return match ($refusal) {
            DomainRefusal::Blank => $this->translator->trans('domain_joining.domain_blank', $example),
            DomainRefusal::Public => $this->translator->trans('domain_joining.domain_public'),
            DomainRefusal::Listed => $this->translator->trans('domain_joining.domain_listed', ['{domain}' => $domain]),
            DomainRefusal::Taken => $this->translator->trans('email_domains.taken'),
            default => $this->translator->trans('domain_joining.domain_invalid', $example),
        };
    }

    private function taken(): ApiException
    {
        return new ApiException(ErrorCode::EmailDomainTaken, $this->translator->trans('email_domains.taken'));
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, EmailDomain $domain, ?User $by, array $changes, ?DateTimeImmutable $at = null): void
    {
        $this->auditor->record(
            $action,
            self::SUBJECT,
            $domain->getOrganisation()->getId(),
            null === $by ? Actor::System : Actor::User,
            $by?->getId(),
            $by?->getName(),
            ['domain' => [$domain->getDomain(), $domain->getDomain()], ...$changes],
            $at,
        );
    }
}
