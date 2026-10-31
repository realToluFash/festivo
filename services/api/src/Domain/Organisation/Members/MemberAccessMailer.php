<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Domain\Organisation\Roles\SeededRoleLabels;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Membership;
use DateTimeImmutable;
use Psl\Str;

/** A suspended member, and a restored one, hear of it in their own language. Neither email says who did it (sc-3575). */
final readonly class MemberAccessMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private SeededRoleLabels $seededRoleLabels,
        private string $webOrigin,
    ) {
    }

    public function sendSuspended(Membership $membership, DateTimeImmutable $at): void
    {
        $user = $membership->getUser();
        $locale = $this->userMailer->localeFor($user);
        $named = ['{organisation}' => $membership->getOrganisation()->getName()];

        $this->send($membership, $locale, 'memberSuspended.subject', [
            $this->userMailer->line('memberSuspended.body', $locale, $named),
            $this->userMailer->line('memberSuspended.ask', $locale, $named),
            $this->userMailer->line('memberSuspended.facts', $locale, [
                ...$named,
                '{when}' => $this->userMailer->moment($at, $user, $locale),
                '{email}' => $user->getPrimaryEmailAddress()?->getAddress() ?? '',
            ]),
            $this->userMailer->line('memberSuspended.others', $locale),
            '--',
            $this->userMailer->line('memberAccess.footer', $locale, $named),
        ]);
    }

    public function sendRestored(Membership $membership, DateTimeImmutable $at): void
    {
        $user = $membership->getUser();
        $locale = $this->userMailer->localeFor($user);
        $role = $membership->getRole();
        $seeded = $role->getSeededAs();
        $named = [
            '{organisation}' => $membership->getOrganisation()->getName(),
            '{role}' => null === $seeded ? $role->getName() ?? '' : $this->seededRoleLabels->label($seeded, $locale),
        ];

        $this->send($membership, $locale, 'memberRestored.subject', [
            $this->userMailer->line('memberRestored.body', $locale, $named),
            $this->userMailer->line('memberRestored.facts', $locale, [...$named, '{when}' => $this->userMailer->moment($at, $user, $locale)]),
            $this->userMailer->line('memberRestored.open', $locale, [...$named, '{link}' => Str\trim_right($this->webOrigin, '/') . '/app']),
            '--',
            $this->userMailer->line('memberAccess.footer', $locale, $named),
        ]);
    }

    /** @param list<string> $paragraphs */
    private function send(Membership $membership, string $locale, string $subjectKey, array $paragraphs): void
    {
        $address = $membership->getUser()->getPrimaryEmailAddress()?->getAddress();

        if (null !== $address) {
            $this->userMailer->send($address, $locale, $subjectKey, $paragraphs, ['{organisation}' => $membership->getOrganisation()->getName()]);
        }
    }
}
