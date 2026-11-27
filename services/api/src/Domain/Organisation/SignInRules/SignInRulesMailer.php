<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\User\Mail\UserMailer;
use App\Entity\User;
use DateTimeImmutable;
use Psl\Str;

/** Every member hears what changed; one who signs in with a password only also hears how to link Google or Apple. */
final readonly class SignInRulesMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes rule => [before, after] */
    public function changed(User $member, string $locale, string $organisation, string $by, array $changes, bool $stranded, DateTimeImmutable $at): RenderedNotification
    {
        $named = ['{organisation}' => $organisation];
        $origin = Str\trim_right($this->webOrigin, '/');
        $paragraphs = [
            $this->userMailer->line('signInRules.changed.body', $locale, [...$named, '{name}' => $by, '{when}' => $this->userMailer->moment($at, $member, $locale)]),
        ];

        foreach ($changes as $rule => [, $now]) {
            $paragraphs[] = '- ' . $this->ruleLine($rule, $now, $locale);
        }

        if ($stranded) {
            $paragraphs[] = $this->userMailer->line('signInRules.changed.link', $locale, $named);
            $paragraphs[] = $this->userMailer->line('signInRules.changed.linkWhere', $locale, ['{link}' => $origin . '/app/account/security']);
        }

        $paragraphs[] = $this->userMailer->line('signInRules.changed.see', $locale, ['{link}' => $origin . '/app/settings/sign-in-rules']);
        $paragraphs[] = '--';
        $paragraphs[] = $this->userMailer->line('signInRules.changed.footer', $locale, $named);

        return new RenderedNotification($this->userMailer->line('signInRules.changed.subject', $locale, $named), Str\join($paragraphs, "\n\n"));
    }

    /** To another Owner: who signed in around the identity provider, how and when. */
    public function breakGlass(User $owner, string $locale, string $organisation, string $by, string $provider, string $method, DateTimeImmutable $at): RenderedNotification
    {
        $named = ['{organisation}' => $organisation, '{name}' => $by, '{provider}' => $provider];
        $link = Str\trim_right($this->webOrigin, '/') . '/app/settings/data-and-control/audit-log';

        return new RenderedNotification($this->userMailer->line('signInRules.breakGlass.subject', $locale, $named), Str\join([
            $this->userMailer->line('signInRules.breakGlass.body', $locale, ['organisation' => $organisation, 'name' => $by, 'provider' => $provider, 'method' => $method, 'when' => $this->userMailer->moment($at, $owner, $locale)]),
            $this->userMailer->line('signInRules.breakGlass.explain', $locale, $named),
            $this->userMailer->line('signInRules.breakGlass.unexpected', $locale, $named),
            $this->userMailer->line('signInRules.breakGlass.open', $locale, ['{link}' => $link]),
            '--',
            $this->userMailer->line('signInRules.breakGlass.footer', $locale, $named),
        ], "\n\n"));
    }

    /** A member without two-factor, told the moment it is required of them, with the instant in their zone (sc-609). */
    public function twoFactorDue(User $member, string $locale, string $address, string $organisation, DateTimeImmutable $deadline): RenderedNotification
    {
        $named = ['{organisation}' => $organisation];
        $due = [...$named, '{deadline}' => $this->userMailer->deadline($deadline, $member, $locale)];
        $origin = Str\trim_right($this->webOrigin, '/');

        return new RenderedNotification($this->userMailer->line('signInRules.twoFactorDue.subject', $locale, $due), Str\join([
            $this->userMailer->line('signInRules.twoFactorDue.body', $locale, $due),
            $this->userMailer->line('signInRules.twoFactorDue.explain', $locale),
            $this->userMailer->line('signInRules.twoFactorDue.facts', $locale, [...$due, '{address}' => $address]),
            $this->userMailer->line('signInRules.twoFactorDue.turnOn', $locale, ['{link}' => $origin . '/app/account/security']),
            '--',
            $this->userMailer->line('signInRules.changed.footer', $locale, $named),
        ], "\n\n"));
    }

    private function ruleLine(string $rule, mixed $now, string $locale): string
    {
        return match (true) {
            'providerOnly' === $rule => $this->userMailer->line(true === $now ? 'signInRules.rule.providerOnly' : 'signInRules.rule.anyMethod', $locale),
            'inactivityTimeoutDays' === $rule && \is_int($now) => $this->userMailer->line('signInRules.rule.inactivity', $locale, ['days' => $now]),
            'inactivityTimeoutDays' === $rule => $this->userMailer->line('signInRules.rule.noLimit', $locale),
            'everyoneNeedsTwoFactor' === $rule => $this->userMailer->line(true === $now ? 'signInRules.rule.everyoneTwoFactor' : 'signInRules.rule.noEveryoneTwoFactor', $locale),
            true === $now => $this->userMailer->line('signInRules.rule.twoFactor', $locale),
            default => $this->userMailer->line('signInRules.rule.noTwoFactor', $locale),
        };
    }
}
