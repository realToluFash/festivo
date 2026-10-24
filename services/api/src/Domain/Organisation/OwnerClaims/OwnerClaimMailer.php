<?php

declare(strict_types=1);

namespace App\Domain\Organisation\OwnerClaims;

use App\Domain\User\Mail\UserMailer;
use App\Entity\OwnerClaim;
use App\Entity\User;
use App\Repository\UserRepository;
use DateTimeImmutable;
use Psl\Str;
use Psl\Type;

/** `owner_claim_started`, `_stopped` and `_granted` (sc-6640): each at a verified primary address, and none lists who else was told. */
final readonly class OwnerClaimMailer
{
    public function __construct(
        private UserMailer $userMailer,
        private UserRepository $userRepository,
        private string $webOrigin,
    ) {
    }

    public function sendStarted(OwnerClaim $claim): void
    {
        $passesAt = Type\instance_of(DateTimeImmutable::class)->coerce($claim->getPassesAt());

        $this->send($claim, 'ownerClaim.started', static fn (User $reader, string $locale, UserMailer $mailer): array => [
            '{deadline}' => $mailer->deadline($passesAt, $reader, $locale),
        ], 'ownerClaim.stopLink');
    }

    public function sendStopped(OwnerClaim $claim, User $by): void
    {
        $at = Type\instance_of(DateTimeImmutable::class)->coerce($claim->getEndedAt());

        $this->send($claim, 'ownerClaim.stopped', static fn (User $reader, string $locale, UserMailer $mailer): array => [
            '{name}' => OwnerClaimDescriber::named($by),
            '{deadline}' => $mailer->deadline($at, $reader, $locale),
        ], 'ownerClaim.openLink');
    }

    public function sendGranted(OwnerClaim $claim): void
    {
        $at = Type\instance_of(DateTimeImmutable::class)->coerce($claim->getEndedAt());

        $this->send($claim, 'ownerClaim.granted', static fn (User $reader, string $locale, UserMailer $mailer): array => [
            '{deadline}' => $mailer->deadline($at, $reader, $locale),
        ], 'ownerClaim.openLink');
    }

    /** @param callable(User, string, UserMailer): array<string, string> $moment the instants, written for each reader */
    private function send(OwnerClaim $claim, string $key, callable $moment, string $linkKey): void
    {
        $claimant = $claim->getClaimant();
        $named = [
            '{claimant}' => OwnerClaimDescriber::named($claimant),
            '{email}' => $claimant->getPrimaryEmailAddress()?->getAddress() ?? '',
            '{organisation}' => $claim->getOrganisation()->getName(),
            '{domain}' => $claim->getDomain(),
        ];
        $link = Str\trim_right($this->webOrigin, '/') . '/app/settings/members';

        foreach ($claim->getTold() as $told) {
            $reader = $this->userRepository->find($told['id']);
            $primary = $reader?->getPrimaryEmailAddress();

            if (null === $reader || null === $primary || !$primary->isVerified()) {
                continue;
            }

            $locale = $this->userMailer->localeFor($reader);
            $words = [...$named, ...$moment($reader, $locale, $this->userMailer), '{link}' => $link];

            $this->userMailer->send($primary->getAddress(), $locale, $key . '.subject', [
                $this->userMailer->line($key . '.heading', $locale, $words),
                $this->userMailer->line('ownerClaim.claimant', $locale, $words),
                $this->userMailer->line('ownerClaim.domain', $locale, $words),
                $this->userMailer->line($key . '.when', $locale, $words),
                $this->userMailer->line($linkKey, $locale, $words),
                '--',
                $this->userMailer->line(OwnerClaimHandler::TOLD_AS_OWNER === $told['as'] ? 'ownerClaim.footer.owner' : 'ownerClaim.footer.administrator', $locale, $words),
            ], $words);
        }
    }
}
