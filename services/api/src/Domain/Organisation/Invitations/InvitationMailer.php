<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Invitations;

use App\Domain\Organisation\Roles\SeededRoleLabels;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Invitation;
use App\Entity\User;
use App\Locale\SupportedLocales;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use LogicException;
use Psl\Str;
use SensitiveParameter;

/** A stranger has no language of their own to know, so theirs is the organisation's. */
final readonly class InvitationMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private SeededRoleLabels $seededRoleLabels,
        private string $webOrigin,
    ) {
    }

    public function send(Invitation $invitation, #[SensitiveParameter] string $token, ?User $recipient, ?string $asked = null): void
    {
        $organisation = $invitation->getOrganisation() ?? throw new LogicException('An invitation is sent only while its organisation exists.');
        $locale = null === $recipient ? SupportedLocales::narrow($organisation->getLocale()) : $this->userMailer->localeFor($recipient, $asked);
        $parameters = [
            '{inviter}' => $invitation->getInvitedBy()?->getName() ?? $organisation->getName(),
            '{organisation}' => $organisation->getName(),
            '{role}' => $this->roleName($invitation, $locale),
        ];
        $paragraphs = [
            $this->userMailer->line('invitation.body', $locale, $parameters),
            $this->link($token),
            $this->userMailer->line('invitation.expiry', $locale, ['{date}' => $this->date($invitation, $organisation->getTimezone(), $locale)]),
        ];

        if (null !== $recipient) {
            $paragraphs[] = $this->userMailer->line('invitation.inProduct', $locale, ['{email}' => $invitation->getEmail()]);
        }

        $paragraphs[] = $this->userMailer->line('invitation.ignore', $locale);

        $this->userMailer->send($invitation->getEmail(), $locale, 'invitation.subject', $paragraphs, $parameters);
    }

    public function link(#[SensitiveParameter] string $token): string
    {
        return Str\trim_right($this->webOrigin, '/') . '/join/' . \rawurlencode($token);
    }

    private function roleName(Invitation $invitation, string $locale): string
    {
        $role = $invitation->getRole();
        $seeded = $role?->getSeededAs();

        return null === $seeded ? $role?->getName() ?? '' : $this->seededRoleLabels->label($seeded, $locale);
    }

    /** The organisation's zone: a stranger has none of their own. */
    private function date(Invitation $invitation, string $timezone, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('EEEEMMMMd') ?: 'EEEE d MMMM';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $timezone, null, $pattern);

        return $formatter?->format($invitation->getExpiresAt()) ?: $invitation->getExpiresAt()->format('Y-m-d');
    }
}
