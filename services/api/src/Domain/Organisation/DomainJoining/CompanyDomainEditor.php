<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Audit\Auditor;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationDomainRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > General > Company domain joining (sc-561): off until a domain is listed. Flushing is the caller's. */
final readonly class CompanyDomainEditor
{
    public const int MOST = 5;
    public const string SUBJECT = 'Organisation';

    public function __construct(
        private OrganisationDomainRepository $organisationDomainRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
    ) {
    }

    public function add(Organisation $organisation, User $by, string $typed): OrganisationDomain
    {
        $domain = DomainNameNormaliser::normalise($typed);
        $refusal = $this->refusal($organisation, $by, $domain);

        if (null !== $refusal) {
            throw ApiException::validation([[
                'propertyPath' => 'domain',
                'message' => $refusal,
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $listing = new OrganisationDomain($organisation, $domain);
        $this->entityManager->persist($listing);
        $this->auditor->record('organisation_domain.added', self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'domain' => [null, $domain],
        ]);

        return $listing;
    }

    public function remove(Organisation $organisation, User $by, string $domain): void
    {
        $listing = $this->organisationDomainRepository->findOneInOrganisation($organisation, DomainNameNormaliser::normalise($domain))
            ?? throw ApiException::notFound($this->translator->trans('domain_joining.not_listed'));

        $this->entityManager->remove($listing);
        $this->auditor->record('organisation_domain.removed', self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'domain' => [$listing->getDomain(), null],
        ]);
    }

    /** Another organisation has proved the domain (sc-560), so this listing no longer lets anybody ask. */
    public function isStopped(OrganisationDomain $listing): bool
    {
        return !Iter\any(
            JoinOfferFinder::working($this->organisationDomainRepository->findListings($listing->getDomain())),
            static fn (OrganisationDomain $working): bool => $working->getId()->equals($listing->getId()),
        );
    }

    /** sc-63's two checks first, the ones the form makes too; then the server's. */
    private function refusal(Organisation $organisation, User $by, string $domain): ?string
    {
        // The example is the person's own domain, the one they can add.
        $example = ['{example}' => JoinOfferFinder::domainFor($by) ?? 'example.com'];

        if ('' === $domain) {
            return $this->translator->trans('domain_joining.domain_blank', $example);
        }

        if (!DomainNameNormaliser::isHostname($domain)) {
            return $this->translator->trans('domain_joining.domain_invalid', $example);
        }

        if (PublicMailDomains::includes($domain)) {
            return $this->translator->trans('domain_joining.domain_public');
        }

        $listed = $this->organisationDomainRepository->findForOrganisation($organisation);

        if (Iter\any($listed, static fn (OrganisationDomain $listing): bool => $listing->getDomain() === $domain)) {
            return $this->translator->trans('domain_joining.domain_listed', ['{domain}' => $domain]);
        }

        if (JoinOfferFinder::domainFor($by) !== $domain) {
            return $this->translator->trans('domain_joining.domain_not_yours');
        }

        if (Iter\count($listed) >= self::MOST) {
            return $this->translator->trans('domain_joining.domain_full', ['{count}' => (string) self::MOST]);
        }

        $provedElsewhere = Iter\any(
            $this->organisationDomainRepository->findListings($domain),
            static fn (OrganisationDomain $listing): bool => null !== $listing->getProvedAt() && !$listing->getOrganisation()->getId()->equals($organisation->getId()),
        );

        return $provedElsewhere ? $this->translator->trans('domain_joining.domain_proved_elsewhere', ['{domain}' => $domain]) : null;
    }
}
