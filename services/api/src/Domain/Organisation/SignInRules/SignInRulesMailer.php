<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\User;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Str;

/** Every member hears what changed; one who signs in with a password only also hears how to link Google or Apple. */
final readonly class SignInRulesMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /**
     * @param array<string, array{0: mixed, 1: mixed}> $changes  rule => [before, after]
     * @param list<User>                               $members
     * @param list<User>                               $stranded the members left reading only until they link one
     */
    public function sendChanged(Organisation $organisation, User $by, array $changes, array $members, array $stranded, DateTimeImmutable $at, ?string $asked = null): void
    {
        foreach ($members as $member) {
            $this->sendTo($member, $organisation, $by, $changes, Iter\any($stranded, static fn (User $user): bool => $user->getId()->equals($member->getId())), $at, $asked);
        }
    }

    /**
     * The members without two-factor, told the moment it is required of them, with the instant in each one's zone (sc-609).
     *
     * @param list<User> $members
     */
    public function sendTwoFactorDue(Organisation $organisation, array $members, DateTimeImmutable $deadline): void
    {
        $origin = Str\trim_right($this->webOrigin, '/');

        foreach ($members as $member) {
            $address = $member->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($member);
            $named = ['{organisation}' => $organisation->getName()];
            $due = [...$named, '{deadline}' => $this->userMailer->deadline($deadline, $member, $locale)];

            $this->userMailer->send($address, $locale, 'signInRules.twoFactorDue.subject', [
                $this->userMailer->line('signInRules.twoFactorDue.body', $locale, $due),
                $this->userMailer->line('signInRules.twoFactorDue.explain', $locale),
                $this->userMailer->line('signInRules.twoFactorDue.facts', $locale, [...$due, '{address}' => $address]),
                $this->userMailer->line('signInRules.twoFactorDue.turnOn', $locale, ['{link}' => $origin . '/app/account/security']),
                '--',
                $this->userMailer->line('signInRules.changed.footer', $locale, $named),
            ], $due);
        }
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function sendTo(User $member, Organisation $organisation, User $by, array $changes, bool $stranded, DateTimeImmutable $at, ?string $asked): void
    {
        $address = $member->getPrimaryEmailAddress()?->getAddress();

        if (null === $address) {
            return;
        }

        $locale = $this->userMailer->localeFor($member, $member->getId()->equals($by->getId()) ? $asked : null);
        $named = ['{organisation}' => $organisation->getName()];
        $origin = Str\trim_right($this->webOrigin, '/');
        $paragraphs = [
            $this->userMailer->line('signInRules.changed.body', $locale, [...$named, '{name}' => $by->getName(), '{when}' => $this->userMailer->moment($at, $member, $locale)]),
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

        $this->userMailer->send($address, $locale, 'signInRules.changed.subject', $paragraphs, $named);
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
