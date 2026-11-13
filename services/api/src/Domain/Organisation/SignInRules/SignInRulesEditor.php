<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Audit\Auditor;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateInterval;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Changing an organisation's sign-in rules: recorded with who and when, and every member told (sc-69). */
final readonly class SignInRulesEditor
{
    public const string CHANGED = 'sign_in_rules.changed';

    public const string SUBJECT = 'Organisation';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private SignInRulesMailer $signInRulesMailer,
        private Auditor $auditor,
        private AfterResponse $afterResponse,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private SignInRules $signInRules,
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * Rules left out keep their value. Nothing changed records nothing and tells nobody. Nobody can
     * require a sign-in method they do not have: two-factor of administrators or of everyone, or Google
     * or Apple only, is refused, changing nothing, while the person asking has none (sc-69, sc-3290, sc-609).
     *
     * @param array{providerOnly?: bool, inactivityTimeoutDays?: ?int, administratorsNeedTwoFactor?: bool, everyoneNeedsTwoFactor?: bool} $asked
     */
    public function change(Organisation $organisation, User $by, array $asked, ?Request $request = null): void
    {
        $twoFactorAsked = true === ($asked['administratorsNeedTwoFactor'] ?? null) || true === ($asked['everyoneNeedsTwoFactor'] ?? null);

        if ($twoFactorAsked && !$this->signInRules->hasTwoFactor($by)) {
            throw new ApiException(ErrorCode::TwoFactorOff, $this->translator->trans('sign_in_rules.two_factor_off'));
        }

        if (true === ($asked['providerOnly'] ?? null) && !$this->signInRules->isLinked($by)) {
            throw new ApiException(ErrorCode::OAuthOnlyUnlinked, $this->translator->trans('sign_in_rules.provider_unlinked'));
        }

        $before = self::rulesOf($organisation);

        if (Iter\contains_key($asked, 'providerOnly')) {
            $organisation->setProviderSignInOnly($asked['providerOnly']);
        }

        if (Iter\contains_key($asked, 'inactivityTimeoutDays')) {
            $organisation->setInactivityTimeoutDays($asked['inactivityTimeoutDays']);
        }

        if (Iter\contains_key($asked, 'administratorsNeedTwoFactor')) {
            $organisation->setAdministratorsNeedTwoFactor($asked['administratorsNeedTwoFactor']);
        }

        $at = $this->clock->now();

        if (Iter\contains_key($asked, 'everyoneNeedsTwoFactor') && $asked['everyoneNeedsTwoFactor'] !== $before['everyoneNeedsTwoFactor']) {
            $organisation->setTwoFactorRequiredSince($asked['everyoneNeedsTwoFactor'] ? $at : null);
            $this->membershipRepository->forgetTwoFactorBlocks($organisation);
        }

        $changes = Auditor::diff($before, self::rulesOf($organisation));

        if ([] === $changes) {
            return;
        }

        $organisation->setSignInRulesChangedAt($at);
        $this->auditor->record(self::CHANGED, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
        $this->entityManager->flush();

        $members = Vec\map($this->membershipRepository->findActiveIn($organisation), static fn (Membership $membership): User => $membership->getUser());
        $stranded = isset($changes['providerOnly']) && $organisation->isProviderSignInOnly()
            ? Vec\map($this->membershipRepository->findActiveWithoutProviderIn($organisation), static fn (Membership $membership): User => $membership->getUser())
            : [];
        $locale = $request?->getLocale();
        $due = isset($changes['everyoneNeedsTwoFactor']) && $organisation->isTwoFactorRequired()
            ? Vec\map($this->membershipRepository->findActiveWithoutTwoFactorIn($organisation), static fn (Membership $membership): User => $membership->getUser())
            : [];

        // Told once: somebody the deadline email reaches does not also hear of the same change in a second one.
        if ([] !== $due && ['everyoneNeedsTwoFactor'] === Vec\keys($changes)) {
            $members = Vec\filter($members, static fn (User $member): bool => !Iter\any($due, static fn (User $user): bool => $user->getId()->equals($member->getId())));
        }

        $this->afterResponse->defer(function () use ($organisation, $by, $changes, $members, $stranded, $due, $at, $locale): void {
            $this->signInRulesMailer->sendChanged($organisation, $by, $changes, $members, $stranded, $at, $locale);
            $this->signInRulesMailer->sendTwoFactorDue($organisation, $due, $at->add(new DateInterval(SignInRules::TWO_FACTOR_GRACE)));
        });
    }

    /** @return array{providerOnly: bool, inactivityTimeoutDays: ?int, administratorsNeedTwoFactor: bool, everyoneNeedsTwoFactor: bool} */
    public static function rulesOf(Organisation $organisation): array
    {
        return [
            'providerOnly' => $organisation->isProviderSignInOnly(),
            'inactivityTimeoutDays' => $organisation->getInactivityTimeoutDays(),
            'administratorsNeedTwoFactor' => $organisation->isAdministratorsNeedTwoFactor(),
            'everyoneNeedsTwoFactor' => $organisation->isTwoFactorRequired(),
        ];
    }
}
