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
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;

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
    ) {
    }

    /**
     * Rules left out keep their value. Nothing changed records nothing and tells nobody. Requiring
     * two-factor of administrators is refused, changing nothing, while the person asking has none.
     *
     * @param array{providerOnly?: bool, inactivityTimeoutDays?: ?int, administratorsNeedTwoFactor?: bool} $asked
     */
    public function change(Organisation $organisation, User $by, array $asked, ?Request $request = null): void
    {
        if (true === ($asked['administratorsNeedTwoFactor'] ?? null) && !$this->signInRules->hasTwoFactor($by)) {
            throw new ApiException(ErrorCode::TwoFactorOff, 'Two-factor is not on.');
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

        $changes = Auditor::diff($before, self::rulesOf($organisation));

        if ([] === $changes) {
            return;
        }

        $at = $this->clock->now();
        $organisation->setSignInRulesChangedAt($at);
        $this->auditor->record(self::CHANGED, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
        $this->entityManager->flush();

        $members = Vec\map($this->membershipRepository->findActiveIn($organisation), static fn (Membership $membership): User => $membership->getUser());
        $stranded = isset($changes['providerOnly']) && $organisation->isProviderSignInOnly()
            ? Vec\map($this->membershipRepository->findActiveWithoutProviderIn($organisation), static fn (Membership $membership): User => $membership->getUser())
            : [];
        $locale = $request?->getLocale();

        $this->afterResponse->defer(fn () => $this->signInRulesMailer->sendChanged($organisation, $by, $changes, $members, $stranded, $at, $locale));
    }

    /** @return array{providerOnly: bool, inactivityTimeoutDays: ?int, administratorsNeedTwoFactor: bool} */
    public static function rulesOf(Organisation $organisation): array
    {
        return [
            'providerOnly' => $organisation->isProviderSignInOnly(),
            'inactivityTimeoutDays' => $organisation->getInactivityTimeoutDays(),
            'administratorsNeedTwoFactor' => $organisation->isAdministratorsNeedTwoFactor(),
        ];
    }
}
