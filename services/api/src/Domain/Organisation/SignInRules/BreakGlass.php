<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Audit\Auditor;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Domain\Organisation\SingleSignOn\SingleSignOnSettings;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\IdentityProvider;
use App\Enum\MembershipStatus;
use App\Repository\MembershipRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;

/** An Owner signing in around required sign-on (sc-610): audited, and the other Owners are emailed. */
final readonly class BreakGlass
{
    public const string USED = 'sso.bypassed';

    /** @mago-expect lint:no-literal-password */
    public const string PASSWORD = 'password';

    public const string PHONE_CODE = 'phone_code';

    public function __construct(
        private SignInRules $signInRules,
        private MembershipRepository $membershipRepository,
        private Auditor $auditor,
        private NotificationScheduler $notificationScheduler,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** Called with every session a sign-in other than the identity provider's starts; anybody but such an Owner passes unrecorded. */
    public function signedIn(User $user, ?IdentityProvider $provider, bool $byPhoneCode, ?Request $request): void
    {
        $bypassed = $this->signInRules->singleSignOnBypassedBy($user);

        if (null === $bypassed) {
            return;
        }

        $organisation = $bypassed->getOrganisation();
        $method = $provider?->value ?? ($byPhoneCode ? self::PHONE_CODE : self::PASSWORD);

        $this->entityManager->wrapInTransaction(function () use ($user, $organisation, $bypassed, $method, $request): void {
            $at = $this->clock->now();
            $entry = $this->auditor->record(self::USED, SingleSignOnSettings::SUBJECT, $organisation->getId(), Actor::User, $user->getId(), $user->getName(), ['signedInWith' => [null, $method]]);
            $others = [];

            foreach ($this->membershipRepository->findOwnersIn($organisation) as $owner) {
                if (MembershipStatus::Active === $owner->getStatus() && !$owner->getUser()->getId()->equals($user->getId())) {
                    $others[] = $owner->getUser()->getId();
                }
            }

            if ([] === $others) {
                return;
            }

            $source = $entry->getId()->toRfc4122();
            $this->notificationScheduler->schedule(
                SignInRulesNotice::NAME,
                $source,
                $source,
                Trigger::at($at),
                Audience::members($organisation->getId(), $others),
                SignInRulesNotice::breakGlass($organisation, $user, $bypassed->getName(), $method, $at, $request?->getLocale()),
            );
        });
    }
}
