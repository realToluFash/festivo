<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Domain\User\Mail\ReadableAgent;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use DateTimeImmutable;
use Psl\Str;
use Psl\Vec;
use SensitiveParameter;

/** Every step of a request to get back in, told to the person, and the request itself to whoever can answer it (sc-509). */
final readonly class TwoFactorRecoveryMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private NotMeLink $notMeLink,
        private string $webOrigin,
    ) {
    }

    public function sendCode(TwoFactorRecovery $recovery, #[SensitiveParameter] string $code): void
    {
        $user = $recovery->getUser();
        $locale = $this->userMailer->localeFor($user);

        $this->userMailer->send($recovery->getEmailAddress()->getAddress(), $locale, 'twoFactorRecovery.code.subject', [
            $this->line('twoFactorRecovery.code.body', $locale),
            $code,
            $this->line('twoFactorRecovery.code.expiry', $locale, ['{minutes}' => (string) VerificationChallenge::LIFETIME_MINUTES]),
            $this->line('twoFactorRecovery.code.notYou', $locale),
            ...$this->notMe($recovery, $locale),
        ]);
    }

    public function sendStarted(TwoFactorRecovery $recovery, ?string $userAgent): void
    {
        $user = $recovery->getUser();
        $locale = $this->userMailer->localeFor($user);
        $agent = ReadableAgent::of($userAgent);

        $this->userMailer->sendToEveryVerified($user, 'twoFactorRecovery.started.subject', [
            $this->line('twoFactorRecovery.started.heading', $locale),
            $this->line('twoFactorRecovery.started.body', $locale),
            Str\join(Vec\filter_nulls([
                $this->line('twoFactorRecovery.fact.when', $locale, ['{when}' => $this->when($recovery->getProvedAt(), $user, $locale)]),
                null === $agent ? null : $this->line('twoFactorRecovery.fact.device', $locale, ['{device}' => $this->line('twoFactorRecovery.device', $locale, ['{browser}' => $agent->browser, '{platform}' => $agent->platform])]),
                $this->line('twoFactorRecovery.fact.expiresIfNobody', $locale, ['{when}' => $this->when($recovery->getExpiresAt(), $user, $locale)]),
            ]), "\n"),
            $this->line('twoFactorRecovery.started.after', $locale),
            ...$this->notMe($recovery, $locale),
            $this->line('twoFactorRecovery.footer', $locale),
        ]);
    }

    /** In the approver's own zone and language: they read it, not the person who asked. */
    public function sendToApprover(TwoFactorRecovery $recovery, User $approver, Organisation $organisation): void
    {
        $user = $recovery->getUser();
        $locale = $this->userMailer->localeFor($approver);
        $address = $approver->getPrimaryEmailAddress()?->getAddress();

        if (null === $address) {
            return;
        }

        $this->userMailer->send($address, $locale, 'twoFactorRecovery.approver.subject', [
            $this->line('twoFactorRecovery.approver.heading', $locale, ['{name}' => $user->getName()]),
            $this->line(null === $recovery->getPhoneNumber() ? 'twoFactorRecovery.approver.bodyEmail' : 'twoFactorRecovery.approver.bodyBoth', $locale),
            Str\join([
                $this->line('twoFactorRecovery.fact.who', $locale, ['{name}' => $user->getName(), '{email}' => $recovery->getEmailAddress()->getAddress()]),
                $this->line('twoFactorRecovery.fact.organisation', $locale, ['{organisation}' => $organisation->getName()]),
                $this->line('twoFactorRecovery.fact.asked', $locale, ['{when}' => $this->when($recovery->getProvedAt(), $approver, $locale)]),
                $this->line('twoFactorRecovery.fact.expires', $locale, ['{when}' => $this->when($recovery->getExpiresAt(), $approver, $locale)]),
            ], "\n"),
            $this->line('twoFactorRecovery.approver.review', $locale, ['{link}' => $this->origin() . '/app/settings']),
            $this->line('twoFactorRecovery.approver.after', $locale),
            $this->line('twoFactorRecovery.approver.footer', $locale, ['{organisation}' => $organisation->getName()]),
        ], ['{name}' => $user->getName()]);
    }

    public function sendApproved(TwoFactorRecovery $recovery, DateTimeImmutable $at): void
    {
        $this->sendOutcome($recovery, 'approved', [
            $this->line('twoFactorRecovery.fact.when', $this->locale($recovery), ['{when}' => $this->when($at, $recovery->getUser(), $this->locale($recovery))]),
            $this->line('twoFactorRecovery.signIn', $this->locale($recovery), ['{link}' => $this->origin() . '/sign-in']),
        ]);
    }

    public function sendTwoFactorOff(TwoFactorRecovery $recovery, DateTimeImmutable $at): void
    {
        $this->sendOutcome($recovery, 'off', [
            $this->line('twoFactorRecovery.fact.when', $this->locale($recovery), ['{when}' => $this->when($at, $recovery->getUser(), $this->locale($recovery))]),
            $this->line('twoFactorRecovery.openSecurity', $this->locale($recovery), ['{link}' => $this->origin() . '/app/account/security']),
        ]);
    }

    public function sendTurnedDown(TwoFactorRecovery $recovery, DateTimeImmutable $at): void
    {
        $this->sendOutcome($recovery, 'turnedDown', [
            $this->line('twoFactorRecovery.fact.when', $this->locale($recovery), ['{when}' => $this->when($at, $recovery->getUser(), $this->locale($recovery))]),
        ]);
    }

    public function sendExpired(TwoFactorRecovery $recovery): void
    {
        $locale = $this->locale($recovery);

        $this->sendOutcome($recovery, 'expired', [Str\join([
            $this->line('twoFactorRecovery.fact.asked', $locale, ['{when}' => $this->when($recovery->getProvedAt(), $recovery->getUser(), $locale)]),
            $this->line('twoFactorRecovery.fact.expired', $locale, ['{when}' => $this->when($recovery->getExpiresAt(), $recovery->getUser(), $locale)]),
        ], "\n")]);
    }

    /** @param list<string> $facts */
    private function sendOutcome(TwoFactorRecovery $recovery, string $kind, array $facts): void
    {
        $locale = $this->locale($recovery);

        $this->userMailer->sendToEveryVerified($recovery->getUser(), 'twoFactorRecovery.' . $kind . '.subject', [
            $this->line('twoFactorRecovery.' . $kind . '.heading', $locale),
            $this->line('twoFactorRecovery.' . $kind . '.body', $locale),
            ...$facts,
            ...$this->notMe($recovery, $locale),
            $this->line('twoFactorRecovery.footer', $locale),
        ]);
    }

    /** @return list<string> */
    private function notMe(TwoFactorRecovery $recovery, string $locale): array
    {
        return [
            $this->line('twoFactorRecovery.notMe', $locale, ['{link}' => $this->notMeLink->url($recovery)]),
            $this->line('twoFactorRecovery.notMeNote', $locale),
        ];
    }

    private function when(?DateTimeImmutable $at, User $reader, string $locale): string
    {
        return $this->userMailer->deadline($at ?? new DateTimeImmutable(), $reader, $locale);
    }

    private function locale(TwoFactorRecovery $recovery): string
    {
        return $this->userMailer->localeFor($recovery->getUser());
    }

    private function origin(): string
    {
        return Str\trim_right($this->webOrigin, '/');
    }

    /** @param array<string, string> $parameters */
    private function line(string $key, string $locale, array $parameters = []): string
    {
        return $this->userMailer->line($key, $locale, $parameters);
    }
}
