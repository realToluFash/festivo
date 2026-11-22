<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Plan;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Enum\AccountMail;
use App\Enum\PlanFeature;
use App\Repository\MembershipRepository;
use DateTimeImmutable;

/** `plan_downgraded`: the organisation's owners and administrators, told which settings were switched off and kept (sc-581). */
final readonly class PlanDowngradeMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private MembershipRepository $membershipRepository,
    ) {
    }

    /** @param non-empty-list<PlanFeature> $switchedOff */
    public function send(Organisation $organisation, array $switchedOff, DateTimeImmutable $at): void
    {
        $named = ['{organisation}' => $organisation->getName()];

        foreach ($this->membershipRepository->findAdministratorsIn($organisation) as $membership) {
            $administrator = $membership->getUser();
            $address = $administrator->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($administrator);
            $settings = [];

            foreach ($switchedOff as $feature) {
                $settings[] = '- ' . $this->userMailer->line('planDowngraded.setting.' . $feature->value, $locale);
            }

            $this->userMailer->send(AccountMail::PlanDowngraded, $address, $locale, 'planDowngraded.subject', [
                $this->userMailer->line('planDowngraded.switchedOff', $locale, ['{day}' => $this->userMailer->deadline($at, $administrator, $locale)]),
                ...$settings,
                $this->userMailer->line('planDowngraded.comeBack', $locale),
                '--',
                $this->userMailer->line('planDowngraded.footer', $locale, $named),
            ], $named);
        }
    }
}
