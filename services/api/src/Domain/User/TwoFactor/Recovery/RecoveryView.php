<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Domain\User\Mail\UserMailer;
use App\Domain\User\Verification\PhoneCodeDispatch;
use App\Entity\Organisation;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Entity\VerifiableContact;
use App\Enum\CodeState;
use App\Enum\TwoFactorRecoveryStatus;
use App\Repository\VerificationChallengeRepository;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** A request as each side reads it: times already written in the reader's zone and language, by the one deadline format. */
final readonly class RecoveryView
{
    public function __construct(
        private RecoveryApprovers $recoveryApprovers,
        private TwoFactorRecoveries $twoFactorRecoveries,
        private VerificationChallengeRepository $verificationChallengeRepository,
        private PhoneCodeDispatch $phoneCodeDispatch,
        private UserMailer $userMailer,
        private ClockInterface $clock,
        private string $supportAddress,
    ) {
    }

    /** @return array<string, mixed> what the start screen names before anything is sent */
    public function opening(User $user): array
    {
        $email = $user->getPrimaryEmailAddress();
        $phone = $user->getPrimaryPhoneNumber();

        return [
            'email' => $email?->getAddress(),
            'phone' => null !== $phone && $phone->isVerified() ? $phone->getNumber() : null,
            'organisations' => self::names($this->recoveryApprovers->askedFor($user)),
            'nobody' => [] === $this->recoveryApprovers->for($user),
        ];
    }

    /** @return array<string, mixed> */
    public function state(TwoFactorRecovery $recovery, ?string $asked): array
    {
        $user = $recovery->getUser();
        $status = $recovery->statusAt($this->clock->now());
        $phone = $recovery->getPhoneNumber();

        return [
            'status' => $status->value,
            'email' => $recovery->getEmailAddress()->getAddress(),
            'phone' => $phone?->getNumber(),
            'organisations' => self::names($this->recoveryApprovers->askedFor($user)),
            'supportAddress' => $this->supportAddress,
            ...$this->times($recovery, $user, $asked),
            'codes' => TwoFactorRecoveryStatus::Proving === $status ? [
                'state' => $this->codeState($recovery)->value,
                'cooldownSeconds' => $this->twoFactorRecoveries->cooldownSeconds($recovery),
                'route' => null === $phone ? null : $this->phoneCodeDispatch->routeOf($phone)?->value,
            ] : null,
        ];
    }

    /** @return array<string, mixed> one request on the approver's card */
    public function request(TwoFactorRecovery $recovery, User $approver, ?string $asked): array
    {
        $user = $recovery->getUser();
        $own = $user->getId()->equals($approver->getId());
        $shared = $own ? $this->recoveryApprovers->organisationsOf($user) : $this->recoveryApprovers->sharedBy($approver, $user);

        return [
            'id' => $recovery->getId()->toRfc4122(),
            'name' => $user->getName(),
            'email' => $recovery->getEmailAddress()->getAddress(),
            'provedPhone' => null !== $recovery->getPhoneNumber(),
            'own' => $own,
            'organisations' => self::names($shared),
            ...$this->times($recovery, $approver, $asked),
        ];
    }

    /** @return array{askedAt: ?string, asked: ?string, expiresAt: ?string, expires: ?string} */
    private function times(TwoFactorRecovery $recovery, User $reader, ?string $asked): array
    {
        $locale = $this->userMailer->localeFor($reader, $asked);
        $written = fn (?DateTimeImmutable $at): ?string => null === $at ? null : $this->userMailer->deadline($at, $reader, $locale);

        return [
            'askedAt' => $recovery->getProvedAt()?->format(\DATE_ATOM),
            'asked' => $written($recovery->getProvedAt()),
            'expiresAt' => $recovery->getExpiresAt()?->format(\DATE_ATOM),
            'expires' => $written($recovery->getExpiresAt()),
        ];
    }

    /** Over both codes, as the screen's banners are: either one expired or spent stops the pair. */
    private function codeState(TwoFactorRecovery $recovery): CodeState
    {
        $states = Vec\map(
            Vec\filter_nulls([$recovery->getEmailAddress(), $recovery->getPhoneNumber()]),
            $this->stateOf(...),
        );

        return match (true) {
            Iter\contains($states, CodeState::Expired) => CodeState::Expired,
            Iter\contains($states, CodeState::Exhausted) => CodeState::Exhausted,
            default => CodeState::Live,
        };
    }

    private function stateOf(VerifiableContact $contact): CodeState
    {
        $challenge = $this->verificationChallengeRepository->findLiveFor($contact);

        return match (true) {
            null === $challenge, $challenge->isExpired() => CodeState::Expired,
            $challenge->isExhausted() => CodeState::Exhausted,
            default => CodeState::Live,
        };
    }

    /**
     * @param list<Organisation> $organisations
     *
     * @return list<string>
     */
    private static function names(array $organisations): array
    {
        return Vec\map($organisations, static fn (Organisation $organisation): string => $organisation->getName());
    }
}
