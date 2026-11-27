<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Domain\Organisation\SignInRules\Model\InactivityLimit;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\TwoFactor\SecondFactors;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\ProviderIdentity;
use App\Entity\SsoProvider;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Grants;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use App\Repository\MembershipRepository;
use App\Repository\ProviderIdentityRepository;
use App\Repository\SsoProviderRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** How an organisation's sign-in rules (sc-69) apply to one member. An organisation with none set changes nothing. */
final readonly class SignInRules
{
    /** The lengths the owner chooses between; null is no limit. */
    public const array INACTIVITY_DAYS = [7, 30];

    /** A member's time to turn two-factor on once it is required: 7 × 24 hours, whatever the clocks do meanwhile. */
    public const string TWO_FACTOR_GRACE = 'PT168H';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private ProviderIdentityRepository $providerIdentityRepository,
        private SecondFactors $secondFactors,
        private EmailDomainRepository $emailDomainRepository,
        private SsoProviderRepository $ssoProviderRepository,
        private UserMailer $userMailer,
        private ClockInterface $clock,
    ) {
    }

    /** The organisation that turns this account's password away: Google or Apple only, and the account has one linked. */
    public function refusingPassword(User $user): ?Organisation
    {
        if (!$this->isLinked($user)) {
            return null;
        }

        return $this->requiringProvider($user);
    }

    /** Any address at the domain, account or not; Owners keep their own sign-in, so a broken provider can't lock them out. */
    public function singleSignOnRefusal(string $address, ?User $user): ?ApiException
    {
        $provider = $this->requiredProviderAt($address);
        $organisation = $provider?->getOrganisation();

        if (null === $provider || null === $organisation || (null !== $user && $this->isOwnerIn($user, $organisation))) {
            return null;
        }

        $named = ['organisation' => $organisation->getName(), 'provider' => $provider->getName()];

        return new ApiException(
            ErrorCode::SsoSignInRequired,
            'sign_in.sso_required',
            [],
            null,
            [],
            [...$named, 'email' => $address],
            ['{organisation}' => $named['organisation'], '{provider}' => $named['provider']],
        );
    }

    /** The provider an Owner's sign-in goes around: required sign-on covers their address, and only being an Owner lets them past it. */
    public function singleSignOnBypassedBy(User $user): ?SsoProvider
    {
        $address = $user->getPrimaryEmailAddress()?->getAddress();
        $provider = null === $address ? null : $this->requiredProviderAt($address);

        return null !== $provider && $this->isOwnerIn($user, $provider->getOrganisation()) ? $provider : null;
    }

    public function refuseUnderSingleSignOn(?string $address, ?User $user): void
    {
        $refusal = null === $address ? null : $this->singleSignOnRefusal($address, $user);

        if (null !== $refusal) {
            throw $refusal;
        }
    }

    /** `oauth_only`, naming the organisation, the address and the providers to use instead: one refusal for sign-in, reset and refresh alike. */
    public function passwordRefusal(User $user): ?ApiException
    {
        $address = $user->getPrimaryEmailAddress()?->getAddress();
        $singleSignOn = null === $address ? null : $this->singleSignOnRefusal($address, $user);

        if (null !== $singleSignOn) {
            return $singleSignOn;
        }

        $organisation = $this->refusingPassword($user);

        if (null === $organisation) {
            return null;
        }

        return new ApiException(
            ErrorCode::OAuthOnly,
            'sign_in.provider_only',
            [],
            null,
            [],
            [
                'organisation' => $organisation->getName(),
                'email' => $user->getPrimaryEmailAddress()?->getAddress() ?? '',
                'providers' => Vec\map(
                    $this->providerIdentityRepository->findBy(['user' => $user], ['provider' => 'ASC']),
                    static fn (ProviderIdentity $identity): string => $identity->getProvider()->value,
                ),
            ],
        );
    }

    /** Whether the organisation's rules leave this member their administrative duties, such as answering a recovery request. */
    public function leavesAdministration(User $user, Organisation $organisation): bool
    {
        $membership = $this->membershipRepository->findActive($user, $organisation->getId());

        return !($organisation->isProviderSignInOnly() && !$this->isLinked($user))
            && !($organisation->isAdministratorsNeedTwoFactor() && !$this->hasTwoFactor($user))
            && !(null !== $membership && $this->isHeldForTwoFactor($membership));
    }

    public function requiringTwoFactor(User $user): ?Organisation
    {
        return Iter\first(Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => null !== $organisation->getTwoFactorRequiredSince(),
        ));
    }

    /** Seven days from the switch-on, or from joining after it (sc-609); none for a member required sign-on leaves out. */
    public function twoFactorDeadline(Membership $membership): ?DateTimeImmutable
    {
        $since = $membership->getOrganisation()->getTwoFactorRequiredSince();
        $joined = $membership->getJoinedAt();

        if (null === $since || null === $joined || $this->isExemptFromTwoFactor($membership)) {
            return null;
        }

        return ($joined > $since ? $joined : $since)->add(new DateInterval(self::TWO_FACTOR_GRACE));
    }

    /**
     * Under required sign-on, a non-Owner whose address is at a proved domain can sign in only through the identity
     * provider, which satisfies two-factor (sc-610, Decided 19 Nov). Owners keep their own sign-in, so stay held.
     */
    public function isExemptFromTwoFactor(Membership $membership): bool
    {
        $organisation = $membership->getOrganisation();
        $address = $membership->getUser()->getPrimaryEmailAddress()?->getAddress();

        if (null === $organisation->getSsoRequiredSince() || $membership->getRole()->isOwner() || null === $address) {
            return false;
        }

        $proved = $this->emailDomainRepository->findProvedOf(Str\after_last($address, '@') ?? '');

        return null !== $proved && $proved->getOrganisation()->getId()->equals($organisation->getId());
    }

    /** Whether the account still has two-factor to turn on for this organisation: not on, and not left out by required sign-on. */
    public function owesTwoFactor(User $user, Uuid $organisationId): bool
    {
        if ($this->hasTwoFactor($user)) {
            return false;
        }

        $membership = $this->membershipRepository->findActive($user, $organisationId);

        return null === $membership || !$this->isExemptFromTwoFactor($membership);
    }

    /** A member whose grace began before this is past the deadline. */
    public function twoFactorGraceStartedBefore(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(self::TWO_FACTOR_GRACE));
    }

    public function isHeldForTwoFactor(Membership $membership): bool
    {
        $deadline = $this->twoFactorDeadline($membership);

        return null !== $deadline && $deadline <= $this->clock->now() && !$this->hasTwoFactor($membership->getUser());
    }

    /** @return ?array{at: string, written: string, overdue: bool} null once two-factor is on, or while nothing requires it */
    public function twoFactorDue(Membership $membership): ?array
    {
        $deadline = $this->twoFactorDeadline($membership);
        $user = $membership->getUser();

        if (null === $deadline || $this->hasTwoFactor($user)) {
            return null;
        }

        return [
            'at' => $deadline->format(DateTimeInterface::ATOM),
            'written' => $this->userMailer->deadline($deadline, $user, $this->userMailer->formattingLocaleFor($user)),
            'overdue' => $deadline <= $this->clock->now(),
        ];
    }

    /** The first organisation the account belongs to that signs in with Google or Apple only. */
    public function requiringProvider(User $user): ?Organisation
    {
        return Iter\first(Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => $organisation->isProviderSignInOnly(),
        ));
    }

    /** Read-only until a provider is linked; administration withheld, or everything past its deadline, until two-factor is on. */
    public function narrow(Grants $grants, Membership $membership): Grants
    {
        $user = $membership->getUser();
        $organisation = $membership->getOrganisation();

        if ($organisation->isProviderSignInOnly() && !$this->isLinked($user)) {
            $grants = $grants->readingOnly();
        }

        if ($organisation->isAdministratorsNeedTwoFactor() && !$this->hasTwoFactor($user)) {
            $grants = $grants->withholdingAdministration();
        }

        if ($this->isHeldForTwoFactor($membership)) {
            $grants = $grants->heldForTwoFactor();
        }

        return $grants;
    }

    /** The shortest limit across every organisation the account belongs to; the earliest joined wins a tie. */
    public function inactivityLimit(User $user): ?InactivityLimit
    {
        $limit = null;

        foreach ($this->organisationsOf($user) as $organisation) {
            $days = $organisation->getInactivityTimeoutDays();

            if (null !== $days && (null === $limit || $days < $limit->days)) {
                $limit = new InactivityLimit($organisation, $days);
            }
        }

        return $limit;
    }

    private function requiredProviderAt(string $address): ?SsoProvider
    {
        $domain = Str\lowercase(Str\after_last($address, '@') ?? '');
        $organisation = $this->emailDomainRepository->findProvedOf($domain)?->getOrganisation();

        if (null === $organisation || null === $organisation->getSsoRequiredSince()) {
            return null;
        }

        return $this->ssoProviderRepository->findLive($organisation);
    }

    private function isOwnerIn(User $user, Organisation $organisation): bool
    {
        return true === $this->membershipRepository->findActive($user, $organisation->getId())?->getRole()->isOwner();
    }

    public function isLinked(User $user): bool
    {
        return $this->providerIdentityRepository->count(['user' => $user]) > 0;
    }

    public function hasTwoFactor(User $user): bool
    {
        return $this->secondFactors->isOn($user);
    }

    /** @return list<Organisation> */
    private function organisationsOf(User $user): array
    {
        return Vec\map($this->membershipRepository->findActiveFor($user), static fn (Membership $membership): Organisation => $membership->getOrganisation());
    }
}
