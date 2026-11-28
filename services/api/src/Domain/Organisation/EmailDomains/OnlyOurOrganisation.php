<?php

declare(strict_types=1);

namespace App\Domain\Organisation\EmailDomains;

use App\Audit\Auditor;
use App\Domain\Organisation\DomainJoining\DomainNameNormaliser;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Only our organisation on a proved domain (sc-563): the Owner's alone to switch on, cancel or switch off; it applies 14 days after it is switched on. */
final readonly class OnlyOurOrganisation
{
    public const string SWITCHED_ON = 'email_domain.only_ours_on';
    public const string NOTICE_SENT = 'email_domain.only_ours_notice_sent';
    public const string APPLIED = 'email_domain.only_ours_applied';
    public const string CANCELLED = 'email_domain.only_ours_cancelled';
    public const string SWITCHED_OFF = 'email_domain.only_ours_off';

    public function __construct(
        private EmailDomainRepository $emailDomainRepository,
        private OwnerCheck $ownerCheck,
        private ManagedNoticeMailer $managedNoticeMailer,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** @return 'off'|'scheduled'|'on' */
    public static function stateOf(EmailDomain $domain, DateTimeImmutable $now): string
    {
        $from = $domain->getOnlyOursFrom();

        return match (true) {
            null === $from => 'off',
            $now < $from => 'scheduled',
            default => 'on',
        };
    }

    public static function startsIfSwitchedOnAt(DateTimeImmutable $at): DateTimeImmutable
    {
        return $at->add(new DateInterval(EmailDomain::ONLY_OURS_NOTICE));
    }

    /** Everyone at the domain is emailed now, each with the instant in their own zone. */
    public function switchOn(Organisation $organisation, User $by, string $domain): void
    {
        $emailDomain = $this->owned($organisation, $by, $domain);

        if (!$emailDomain->isProved()) {
            throw ApiException::validation([[
                'propertyPath' => 'domain',
                'message' => $this->translator->trans('email_domains.only_ours_unproved'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        if (null !== $emailDomain->getOnlyOursFrom()) {
            return;
        }

        $now = $this->clock->now();
        $this->entityManager->wrapInTransaction(function () use ($emailDomain, $by, $now): void {
            $this->entityManager->refresh($emailDomain, LockMode::PESSIMISTIC_WRITE);

            if (null !== $emailDomain->getOnlyOursFrom()) {
                return;
            }

            $from = $emailDomain->switchOnlyOursOn($now);
            $this->record(self::SWITCHED_ON, $emailDomain, $by, ['onlyOurs' => ['off', 'scheduled'], 'from' => [null, $from->format(\DATE_ATOM)]], $now);
            $sent = $this->managedNoticeMailer->send($emailDomain, $from);
            $this->record(self::NOTICE_SENT, $emailDomain, null, ['recipients' => [null, $sent]], $now);
            $this->entityManager->flush();
        });
    }

    /** Cancelled before it applies, switched off after: either way nobody at the domain is managed any longer. */
    public function switchOff(Organisation $organisation, User $by, string $domain): void
    {
        $emailDomain = $this->owned($organisation, $by, $domain);
        $now = $this->clock->now();
        $was = self::stateOf($emailDomain, $now);

        if ('off' === $was) {
            return;
        }

        $emailDomain->switchOnlyOursOff();
        $this->record('scheduled' === $was ? self::CANCELLED : self::SWITCHED_OFF, $emailDomain, $by, ['onlyOurs' => [$was, 'off']], $now);
        $this->entityManager->flush();
    }

    /** @return int how many started applying; each is recorded at its own instant, not at the sweep's */
    public function applyDue(): int
    {
        $applied = 0;

        foreach ($this->emailDomainRepository->findOnlyOursDue($this->clock->now()) as $due) {
            $from = $due->getOnlyOursFrom();

            if (null === $from) {
                continue;
            }

            $due->onlyOursApplied($from);
            $this->record(self::APPLIED, $due, null, ['onlyOurs' => ['scheduled', 'on']], $from);
            ++$applied;
        }

        $this->entityManager->flush();

        return $applied;
    }

    private function owned(Organisation $organisation, User $by, string $domain): EmailDomain
    {
        $this->ownerCheck->require($organisation, $by, 'email_domains.only_ours_owner');

        return $this->emailDomainRepository->findOneInOrganisation($organisation, DomainNameNormaliser::normalise($domain))
            ?? throw ApiException::notFound($this->translator->trans('email_domains.not_listed'));
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, EmailDomain $domain, ?User $by, array $changes, DateTimeImmutable $at): void
    {
        $this->auditor->record(
            $action,
            EmailDomains::SUBJECT,
            $domain->getOrganisation()->getId(),
            null === $by ? Actor::System : Actor::User,
            $by?->getId(),
            $by?->getName(),
            ['domain' => [$domain->getDomain(), $domain->getDomain()], ...$changes],
            $at,
        );
    }
}
