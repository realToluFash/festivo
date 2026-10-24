<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Audit\Auditor;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\TokenIssuer;
use App\Domain\User\Verification\ContactVerifier;
use App\Domain\User\Verification\PhoneCodeDispatch;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\TwoFactorRecovery;
use App\Entity\TwoFactorRecoveryHandle;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\TwoFactorRecoveryStatus;
use App\Http\Exception\ApiException;
use App\Repository\TwoFactorChallengeRepository;
use App\Repository\TwoFactorFactorRepository;
use App\Repository\TwoFactorRecoveryRepository;
use App\Repository\VerificationChallengeRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Math;
use Psl\SecureRandom;
use Psl\Type;
use Psr\Clock\ClockInterface;
use SensitiveParameter;

/** The person's side of getting back in without the second factor (sc-509). Nothing here signs anybody in. */
final readonly class TwoFactorRecoveries
{
    private const int HANDLE_BYTES = 32;
    private const string SUBJECT = 'two_factor_recovery';

    public function __construct(
        private TwoFactorChallengeRepository $twoFactorChallengeRepository,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private TwoFactorRecoveryRepository $twoFactorRecoveryRepository,
        private VerificationChallengeRepository $verificationChallengeRepository,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private ContactVerifier $contactVerifier,
        private PhoneCodeDispatch $phoneCodeDispatch,
        private RecoveryApprovers $recoveryApprovers,
        private TwoFactorRecoveryMailer $twoFactorRecoveryMailer,
        private TokenIssuer $tokenIssuer,
        private Auditor $auditor,
        private UserMailer $userMailer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** Only from the second-factor step of a sign-in: whoever asks has already passed the first factor. */
    public function personAt(#[SensitiveParameter] string $challengeToken): User
    {
        $challenge = $this->twoFactorChallengeRepository->findOneByHash(TokenIssuer::hash($challengeToken));

        if (null === $challenge || !$challenge->isOpenAt($this->clock->now()) || null === $this->twoFactorFactorRepository->findActiveFor($challenge->getUser())) {
            throw new ApiException(ErrorCode::TwoFactorChallengeInvalid, 'Sign in again.');
        }

        return $challenge->getUser();
    }

    /** @return array{0: TwoFactorRecovery, 1: string}|null an open request, with this device's own handle; others' still work */
    public function resume(User $user): ?array
    {
        $open = $this->twoFactorRecoveryRepository->findOpenFor($user)[0] ?? null;

        if (null === $open || !$open->statusAt($this->clock->now())->isOpen()) {
            return null;
        }

        $handle = $this->hold($open);
        $this->entityManager->flush();

        return [$open, $handle];
    }

    /** @return array{0: TwoFactorRecovery, 1: string} the request and its handle, the codes sent */
    public function start(User $user): array
    {
        // A refusal is returned, not thrown, out of the transaction: a throw there closes the entity manager.
        $started = $this->entityManager->wrapInTransaction(function () use ($user): array|ApiException {
            // Under the account's row lock, so two starts at once count against the same 3 a day.
            $this->entityManager->refresh($user, LockMode::PESSIMISTIC_WRITE);
            $now = $this->clock->now();
            $email = $user->getPrimaryEmailAddress();

            if ([] === $this->recoveryApprovers->for($user) || null === $email || !$email->isVerified()) {
                return new ApiException(ErrorCode::RecoveryNobodyToApprove, 'Nobody in your organisation can confirm this. Contact Soirely support.');
            }

            $limit = $this->overLimit($user);

            if (null !== $limit) {
                return $limit;
            }

            foreach ($this->twoFactorRecoveryRepository->findOpenFor($user) as $earlier) {
                $earlier->close(TwoFactorRecoveryStatus::Replaced, $now);
                $this->audit('two_factor_recovery.replaced', $earlier, Actor::User, $user);
            }

            $phone = $user->getPrimaryPhoneNumber();
            $phone = null !== $phone && $phone->isVerified() ? $phone : null;
            $phone?->forgetCodesByText();

            $recovery = new TwoFactorRecovery($user, $email, $phone);
            $this->entityManager->persist($recovery);
            $handle = $this->hold($recovery);
            $this->audit('two_factor_recovery.started', $recovery, Actor::User, $user);
            $this->sendCodes($recovery);
            $this->entityManager->flush();

            return [$recovery, $handle];
        });

        if ($started instanceof ApiException) {
            throw $started;
        }

        return Type\shape([0 => Type\instance_of(TwoFactorRecovery::class), 1 => Type\string()])->coerce($started);
    }

    /** Every step from a device answers with the account's current request, so a replaced one says so on each. */
    public function find(#[SensitiveParameter] string $handle): TwoFactorRecovery
    {
        $recovery = $this->twoFactorRecoveryRepository->findOneByHandle(TokenIssuer::hash($handle))
            ?? throw new ApiException(ErrorCode::RecoveryRequestInvalid, 'Start again from the sign-in code screen.');

        if (TwoFactorRecoveryStatus::Replaced === $recovery->statusAt($this->clock->now())) {
            throw new ApiException(ErrorCode::RecoveryRequestReplaced, 'A newer request was started on another device. Start again to ask from here.', [], null, [], ['requestStatus' => TwoFactorRecoveryStatus::Replaced->value]);
        }

        return $recovery;
    }

    public function poll(TwoFactorRecovery $recovery): void
    {
        $phone = $recovery->getPhoneNumber();

        if (TwoFactorRecoveryStatus::Proving === $recovery->statusAt($this->clock->now()) && null !== $phone) {
            $this->phoneCodeDispatch->fallBackIfDue($phone);
        }
    }

    public function resend(TwoFactorRecovery $recovery): void
    {
        $this->proving($recovery);
        $left = $this->cooldownSeconds($recovery);

        if ($left > 0) {
            throw new ApiException(ErrorCode::TooManyAttempts, 'Wait before asking for new codes.', [], null, ['Retry-After' => (string) $left]);
        }

        $this->entityManager->wrapInTransaction(function () use ($recovery): void {
            $this->sendCodes($recovery);
            $this->entityManager->flush();
        });
    }

    public function textInstead(TwoFactorRecovery $recovery): void
    {
        $this->proving($recovery);
        $phone = $recovery->getPhoneNumber()
            ?? throw new ApiException(ErrorCode::Conflict, 'This request has no phone code.');

        $this->phoneCodeDispatch->textInstead($phone);
    }

    public function cooldownSeconds(TwoFactorRecovery $recovery): int
    {
        $newest = null;

        foreach (self::contactsOf($recovery) as $contact) {
            $sent = $this->verificationChallengeRepository->findNewestFor($contact)?->getCreatedAt();
            $newest = null === $newest || (null !== $sent && $sent > $newest) ? $sent : $newest;
        }

        return null === $newest ? 0 : Math\maxva(0, $newest->getTimestamp() + VerificationChallenge::RESEND_COOLDOWN_SECONDS - new DateTimeImmutable()->getTimestamp());
    }

    /** Both codes or neither: a wrong one is counted against its own code, and nothing is spent until both match. */
    public function prove(TwoFactorRecovery $recovery, #[SensitiveParameter] string $emailCode, #[SensitiveParameter] ?string $phoneCode, ?string $userAgent): void
    {
        $this->proving($recovery);

        $refusal = $this->entityManager->wrapInTransaction(function () use ($recovery, $emailCode, $phoneCode): ?ApiException {
            $this->entityManager->refresh($recovery, LockMode::PESSIMISTIC_WRITE);

            $past = $this->pastItsCodes($recovery);

            if (null !== $past) {
                return $past;
            }
            $pairs = ['emailCode' => [$recovery->getEmailAddress(), $emailCode]];
            $phone = $recovery->getPhoneNumber();

            if (null !== $phone) {
                $pairs['phoneCode'] = [$phone, $phoneCode ?? ''];
            }

            $live = [];
            $wrong = [];

            foreach ($pairs as $field => [$contact, $code]) {
                $challenge = $this->verificationChallengeRepository->findLiveFor($contact);

                if (null === $challenge) {
                    return new ApiException(ErrorCode::VerificationCodeExpired, 'Those codes have expired.');
                }

                try {
                    $this->contactVerifier->check($challenge, $code);
                    $live[] = $challenge;
                } catch (ApiException $e) {
                    if (ErrorCode::VerificationCodeInvalid !== $e->errorCode) {
                        return $e;
                    }

                    $wrong[] = ['propertyPath' => $field, 'message' => 'That code does not match.', 'code' => ErrorCode::VerificationCodeInvalid->value];
                }
            }

            if ([] !== $wrong) {
                return new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.', $wrong);
            }

            $now = $this->clock->now();

            foreach ($live as $challenge) {
                $challenge->setRevokedAt($now);
            }

            // The last approver may have left since it started: nobody is told of a request nobody can answer.
            if ([] === $this->recoveryApprovers->for($recovery->getUser())) {
                $recovery->close(TwoFactorRecoveryStatus::Cancelled, $now);
                $this->audit('two_factor_recovery.nobody_to_approve', $recovery, Actor::System, null);
                $this->entityManager->flush();

                return new ApiException(ErrorCode::RecoveryNobodyToApprove, 'Nobody in your organisation can confirm this. Contact Soirely support.');
            }

            $recovery->proved($now);
            $this->audit('two_factor_recovery.requested', $recovery, Actor::User, $recovery->getUser());
            $this->entityManager->flush();

            return null;
        });

        if ($refusal instanceof ApiException) {
            throw $refusal;
        }

        $this->tellEveryone($recovery, $userAgent);
    }

    /** "This wasn't you? Cancel the request": whoever is on that screen has the password, so every session ends too. */
    public function cancel(TwoFactorRecovery $recovery): void
    {
        if (!$recovery->statusAt($this->clock->now())->isOpen()) {
            throw new ApiException(ErrorCode::RecoveryRequestClosed, 'This request has already ended.', [], null, [], ['requestStatus' => $recovery->statusAt($this->clock->now())->value]);
        }

        $this->notMe($recovery->getUser());
    }

    public function notMe(User $user): void
    {
        $now = $this->clock->now();

        foreach ($this->twoFactorRecoveryRepository->findOpenFor($user) as $open) {
            if ($open->statusAt($now)->isOpen()) {
                $open->close(TwoFactorRecoveryStatus::Cancelled, $now);
                $this->audit('two_factor_recovery.cancelled', $open, Actor::User, $user);
            }
        }

        $this->tokenIssuer->revokeAllFor($user);
        $this->entityManager->flush();
    }

    /** A new handle on the request for this device, its plain value for the client. */
    private function hold(TwoFactorRecovery $recovery): string
    {
        $handle = self::handle();
        $this->entityManager->persist(new TwoFactorRecoveryHandle($recovery, TokenIssuer::hash($handle)));

        return $handle;
    }

    private function tellEveryone(TwoFactorRecovery $recovery, ?string $userAgent): void
    {
        $user = $recovery->getUser();
        $this->twoFactorRecoveryMailer->sendStarted($recovery, $userAgent);

        foreach ($this->recoveryApprovers->for($user) as $approver) {
            $shared = $this->recoveryApprovers->sharedBy($approver, $user);

            if ([] !== $shared) {
                $this->twoFactorRecoveryMailer->sendToApprover($recovery, $approver, $shared[0]);
            }
        }
    }

    private function sendCodes(TwoFactorRecovery $recovery): void
    {
        $email = $this->verificationCodeIssuer->issueFor($recovery->getEmailAddress());
        $this->entityManager->flush();
        $this->twoFactorRecoveryMailer->sendCode($recovery, $email->code);

        $phone = $recovery->getPhoneNumber();

        if (null !== $phone) {
            $this->phoneCodeDispatch->send($phone, $this->verificationCodeIssuer->issueFor($phone));
        }
    }

    private function proving(TwoFactorRecovery $recovery): void
    {
        $refusal = $this->pastItsCodes($recovery);

        if (null !== $refusal) {
            throw $refusal;
        }
    }

    /** Proved and waiting is not ended: it says so with its own type, so a screen can open on the waiting state (#1121). */
    private function pastItsCodes(TwoFactorRecovery $recovery): ?ApiException
    {
        $status = $recovery->statusAt($this->clock->now());

        return match ($status) {
            TwoFactorRecoveryStatus::Proving => null,
            TwoFactorRecoveryStatus::Waiting => new ApiException(ErrorCode::RecoveryRequestProved, 'This request is already waiting for an answer.', [], null, [], ['requestStatus' => $status->value]),
            default => new ApiException(ErrorCode::RecoveryRequestClosed, 'This request has already ended.', [], null, [], ['requestStatus' => $status->value]),
        };
    }

    /** On the rows' own clock, as `created_at` is written, like a code's cooldown. */
    private function overLimit(User $user): ?ApiException
    {
        $started = $this->twoFactorRecoveryRepository->startedSince($user, new DateTimeImmutable('-24 hours'));

        if (Iter\count($started) < TwoFactorRecovery::PER_DAY) {
            return null;
        }

        $locale = $this->userMailer->shownLocaleFor($user);

        return ApiException::tooManyAttemptsUntil(
            'You can ask 3 times a day.',
            $started[Iter\count($started) - TwoFactorRecovery::PER_DAY]->modify('+24 hours'),
            fn (DateTimeImmutable $at): string => $this->userMailer->deadline($at, $user, $locale),
        );
    }

    private function audit(string $action, TwoFactorRecovery $recovery, Actor $actor, ?User $by): void
    {
        $this->auditor->record($action, self::SUBJECT, $recovery->getId(), $actor, $by?->getId(), $by?->getName());
    }

    /** @return list<EmailAddress|PhoneNumber> */
    private static function contactsOf(TwoFactorRecovery $recovery): array
    {
        $phone = $recovery->getPhoneNumber();

        return null === $phone ? [$recovery->getEmailAddress()] : [$recovery->getEmailAddress(), $phone];
    }

    private static function handle(): string
    {
        return \bin2hex(SecureRandom\bytes(self::HANDLE_BYTES));
    }
}
