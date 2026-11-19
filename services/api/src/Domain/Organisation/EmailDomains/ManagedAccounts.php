<?php

declare(strict_types=1);

namespace App\Domain\Organisation\EmailDomains;

use App\Audit\Auditor;
use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\DomainJoining\DomainNameNormaliser;
use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\PlanFeature;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A managed account (sc-563): its verified main address is at a domain whose prover's Only our organisation applies, on Enterprise. */
final readonly class ManagedAccounts
{
    public const string REFUSED = 'managed_account.refused';

    public function __construct(
        private EmailDomainRepository $emailDomainRepository,
        private MembershipRepository $membershipRepository,
        private Entitlements $entitlements,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    public function managing(User $user): ?EmailDomain
    {
        $domain = JoinOfferFinder::domainFor($user);

        return null === $domain ? null : $this->managingDomain($domain);
    }

    public function managingAddress(string $address): ?EmailDomain
    {
        $domain = DomainNameNormaliser::domainOf($address);

        return null === $domain ? null : $this->managingDomain($domain);
    }

    public function isHome(EmailDomain $managing, Organisation $organisation): bool
    {
        return $managing->getOrganisation()->getId()->equals($organisation->getId());
    }

    /** `$into` is the organisation joined, or null for one being created. Recorded about the person's own account, which no organisation's log shows. */
    public function refuseUnlessHome(User $user, ?Organisation $into, string $path): void
    {
        $managing = $this->managing($user);

        if (null === $managing || (null !== $into && $this->isHome($managing, $into))) {
            return;
        }

        $this->auditor->record(self::REFUSED, 'Account', $user->getId(), Actor::User, $user->getId(), $user->getName(), [
            'path' => [null, $path],
            'domain' => [null, $managing->getDomain()],
            'organisation' => [null, $into?->getId()->toRfc4122()],
        ]);
        $this->entityManager->flush();

        throw $this->refusal($managing);
    }

    public function refusal(EmailDomain $managing): ApiException
    {
        return new ApiException(ErrorCode::DomainManaged, $this->message($managing), members: [
            'organisation' => $managing->getOrganisation()->getName(),
            'domain' => $managing->getDomain(),
        ]);
    }

    public function message(EmailDomain $managing): string
    {
        return $this->translator->trans('email_domains.managed', [
            '{domain}' => $managing->getDomain(),
            '{organisation}' => $managing->getOrganisation()->getName(),
        ]);
    }

    /** @return ?array{domain: string, organisation: array{id: string, name: string}, message: string} */
    public function describe(User $user): ?array
    {
        $managing = $this->managing($user);

        return null === $managing ? null : [
            'domain' => $managing->getDomain(),
            'organisation' => ['id' => $managing->getOrganisation()->getId()->toRfc4122(), 'name' => $managing->getOrganisation()->getName()],
            'message' => $this->message($managing),
        ];
    }

    /** @return ?array{domain: string, organisation: array{id: string, name: string}, message: string} null into the account's home */
    public function describeFor(User $user, Organisation $into): ?array
    {
        $managing = $this->managing($user);

        return null === $managing || $this->isHome($managing, $into) ? null : $this->describe($user);
    }

    /**
     * @param list<User> $users
     *
     * @return array<string, int> by account id, only for the accounts it manages: never which organisations
     */
    public function otherMembershipsOf(array $users, Organisation $home): array
    {
        $domains = $this->domainsManagedBy($home);
        $managed = [] === $domains ? [] : Vec\filter($users, static function (User $user) use ($domains): bool {
            $domain = JoinOfferFinder::domainFor($user);

            return null !== $domain && Iter\contains($domains, $domain);
        });

        if ([] === $managed) {
            return [];
        }

        $held = $this->membershipRepository->countHeldElsewhere($managed, $home);

        return Dict\from_keys(
            Vec\map($managed, static fn (User $user): string => $user->getId()->toRfc4122()),
            static fn (string $id): int => $held[$id] ?? 0,
        );
    }

    /** @return list<string> */
    private function domainsManagedBy(Organisation $home): array
    {
        if (!$this->entitlements->of($home->getId())->unlocks(PlanFeature::EmailDomains)) {
            return [];
        }

        $now = $this->clock->now();

        return Vec\map(
            Vec\filter($this->emailDomainRepository->findForOrganisation($home), static fn (EmailDomain $domain): bool => $domain->isProved() && 'on' === OnlyOurOrganisation::stateOf($domain, $now)),
            static fn (EmailDomain $domain): string => $domain->getDomain(),
        );
    }

    private function managingDomain(string $domain): ?EmailDomain
    {
        $proof = $this->emailDomainRepository->findProvedOf($domain);

        return null !== $proof && 'on' === OnlyOurOrganisation::stateOf($proof, $this->clock->now())
            && $this->entitlements->of($proof->getOrganisation()->getId())->unlocks(PlanFeature::EmailDomains)
            ? $proof
            : null;
    }
}
