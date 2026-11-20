<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Audit\Auditor;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Changing an organisation's sign-in rules: recorded with who and when, and every member told once the save has answered (sc-69, sc-18317). */
final readonly class SignInRulesEditor
{
    public const string CHANGED = 'sign_in_rules.changed';

    public const string SUBJECT = 'Organisation';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private NotificationScheduler $notificationScheduler,
        private Auditor $auditor,
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

        $this->entityManager->wrapInTransaction(function () use ($organisation, $by, $before, $asked, $request): void {
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
            $entry = $this->auditor->record(self::CHANGED, self::SUBJECT, $organisation->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
            $this->entityManager->flush();

            $twoFactorRequired = isset($changes['everyoneNeedsTwoFactor']) && $organisation->isTwoFactorRequired();
            $emails = $twoFactorRequired && ['everyoneNeedsTwoFactor'] !== Vec\keys($changes)
                ? [SignInRulesNotice::CHANGED, SignInRulesNotice::DUE]
                : [SignInRulesNotice::CHANGED];

            foreach ($emails as $email) {
                $source = $entry->getId()->toRfc4122() . ':' . $email;
                $this->notificationScheduler->schedule(
                    SignInRulesNotice::NAME,
                    $source,
                    $source,
                    Trigger::at($at),
                    Audience::membersJoinedBy($organisation->getId(), $at),
                    SignInRulesNotice::payload($email, $organisation, $by, $changes, $at, $request?->getLocale()),
                );
            }
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
