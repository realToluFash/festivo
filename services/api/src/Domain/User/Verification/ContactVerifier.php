<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Entity\VerifiableContact;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\VerificationChallengeRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;

/** An email address or a phone, proved by its code: one set of rules, so neither drifts from the other. */
final readonly class ContactVerifier
{
    public function __construct(
        private VerificationChallengeRepository $verificationChallengeRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The refusal, or null. Re-read under the row lock, so a waiting request sees what the first committed. */
    public function attempt(VerifiableContact $contact, string $code): ?ApiException
    {
        return $this->entityManager->wrapInTransaction(function () use ($contact, $code): ?ApiException {
            $this->entityManager->refresh($contact, LockMode::PESSIMISTIC_WRITE);

            try {
                $this->verify($contact, $code);
                $this->entityManager->flush();
            } catch (ApiException $e) {
                return $e;
            }

            return null;
        });
    }

    public function verify(VerifiableContact $contact, string $code): void
    {
        if ($contact->isVerified()) {
            return;
        }

        $challenge = $this->verificationChallengeRepository->findLiveFor($contact);

        if (null === $challenge || '' === Str\trim($code)) {
            throw new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.');
        }

        if ($challenge->isExpired()) {
            throw new ApiException(ErrorCode::VerificationCodeExpired, 'That code has expired.');
        }

        // Stays the live challenge once spent, so every later try hears why, until a resend replaces it.
        if ($challenge->isExhausted()) {
            throw new ApiException(ErrorCode::VerificationCodeExhausted, 'That code no longer works.');
        }

        if (!\hash_equals($challenge->getCodeHash(), VerificationCodeIssuer::hash($code))) {
            $this->refuse($challenge);
        }

        $contact->setVerifiedAt(new DateTimeImmutable());
        $challenge->setRevokedAt(new DateTimeImmutable());
    }

    /** Written at once: the throw below skips the caller's flush, and the attempt must survive it. */
    private function refuse(VerificationChallenge $challenge): never
    {
        $this->verificationChallengeRepository->recordWrongAttempt($challenge);

        throw $challenge->isExhausted()
            ? new ApiException(ErrorCode::VerificationCodeExhausted, 'That code no longer works.')
            : new ApiException(ErrorCode::VerificationCodeInvalid, 'That code does not match.');
    }
}
