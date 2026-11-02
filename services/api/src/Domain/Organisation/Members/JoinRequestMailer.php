<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Domain\User\Mail\UserMailer;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** What the person who asked hears when their request ends, and what the people deciding hear when requests wait (sc-392). */
final readonly class JoinRequestMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private string $webOrigin,
    ) {
    }

    /** Nobody is named: who turned a request down is the organisation's, not the asker's. */
    public function sendTurnedDown(Membership $membership): void
    {
        $this->toAsker($membership, 'turnedDown', []);
    }

    public function sendExpired(Membership $membership, DateTimeImmutable $at): void
    {
        $this->toAsker($membership, 'expired', ['{deadline}' => $this->userMailer->deadline($at, $membership->getUser(), $this->userMailer->localeFor($membership->getUser()))]);
    }

    /**
     * @param list<User>       $deciders
     * @param list<Membership> $requests the ones waiting, oldest first
     */
    public function sendWaiting(Organisation $organisation, array $deciders, array $requests): void
    {
        $origin = Str\trim_right($this->webOrigin, '/');

        foreach ($deciders as $decider) {
            $address = $decider->getPrimaryEmailAddress()?->getAddress();

            if (null === $address) {
                continue;
            }

            $locale = $this->userMailer->localeFor($decider);
            $named = ['{organisation}' => $organisation->getName()];

            $this->userMailer->send($address, $locale, 'joinRequest.waiting.subject', [
                $this->userMailer->line('joinRequest.waiting.body', $locale, [...$named, 'count' => Iter\count($requests)]),
                ...Vec\map($requests, fn (Membership $request): string => '- ' . $this->userMailer->line('joinRequest.waiting.person', $locale, [
                    '{name}' => $request->getUser()->getName(),
                    '{email}' => $request->getUser()->getPrimaryEmailAddress()?->getAddress() ?? '',
                    '{deadline}' => $this->userMailer->deadline($request->getRequestExpiresAt() ?? $request->getCreatedAt(), $decider, $locale),
                ])),
                $this->userMailer->line('joinRequest.waiting.answer', $locale, ['{link}' => $origin . '/app/settings/members']),
                '--',
                $this->userMailer->line('joinRequest.waiting.footer', $locale, $named),
            ], $named);
        }
    }

    /** @param array<string, string> $parameters */
    private function toAsker(Membership $membership, string $ending, array $parameters): void
    {
        $user = $membership->getUser();
        $address = $user->getPrimaryEmailAddress()?->getAddress();

        if (null === $address) {
            return;
        }

        $locale = $this->userMailer->localeFor($user);
        $named = ['{organisation}' => $membership->getOrganisation()->getName()];

        $this->userMailer->send($address, $locale, 'joinRequest.' . $ending . '.subject', [
            $this->userMailer->line('joinRequest.' . $ending . '.body', $locale, [...$named, ...$parameters]),
            $this->userMailer->line('joinRequest.askAgain', $locale, $named),
        ], $named);
    }
}
