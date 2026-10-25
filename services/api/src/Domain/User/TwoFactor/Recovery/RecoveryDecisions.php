<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor\Recovery;

use App\Audit\Auditor;
use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\User\TokenIssuer;
use App\Entity\Organisation;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\TwoFactorRecoveryStatus;
use App\Http\Exception\ApiException;
use App\Repository\RecoveryCodeRepository;
use App\Repository\TwoFactorFactorRepository;
use App\Repository\TwoFactorRecoveryRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** An owner's or admin's answer to a request to get back in (sc-509), and the requests that lapse unanswered. */
final readonly class RecoveryDecisions
{
    private const string SUBJECT = 'two_factor_recovery';

    public function __construct(
        private TwoFactorRecoveryRepository $twoFactorRecoveryRepository,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private RecoveryCodeRepository $recoveryCodeRepository,
        private RecoveryApprovers $recoveryApprovers,
        private TwoFactorRecoveryMailer $twoFactorRecoveryMailer,
        private TokenIssuer $tokenIssuer,
        private SignInRules $signInRules,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** @return list<TwoFactorRecovery> waiting on an answer this person may give, their own among them */
    public function waitingFor(User $approver): array
    {
        return Vec\filter(
            $this->twoFactorRecoveryRepository->findWaitingAnswerableBy($approver, RecoveryApprovers::ROLES, $this->clock->now()),
            fn (TwoFactorRecovery $recovery): bool => $this->mayAnswer($approver, $recovery),
        );
    }

    /** Two-factor off, every recovery code spent, every session ended; they sign in again and are asked to set it up. */
    public function approve(User $approver, string $id): void
    {
        $recovery = $this->decide($approver, $id, TwoFactorRecoveryStatus::Approved, function (TwoFactorRecovery $recovery): void {
            $user = $recovery->getUser();
            $factor = $this->twoFactorFactorRepository->findActiveFor($user);

            if (null !== $factor) {
                $this->entityManager->remove($factor);
            }

            $this->recoveryCodeRepository->deleteAllFor($user);
            $this->tokenIssuer->revokeAllFor($user);
            $user->setTwoFactorSetupPrompt(true);
        });

        $at = $recovery->getClosedAt() ?? $this->clock->now();
        $this->twoFactorRecoveryMailer->sendApproved($recovery, $at);
        $this->twoFactorRecoveryMailer->sendTwoFactorOff($recovery, $at);
    }

    public function turnDown(User $approver, string $id): void
    {
        $recovery = $this->decide($approver, $id, TwoFactorRecoveryStatus::TurnedDown, static function (): void {});

        $this->twoFactorRecoveryMailer->sendTurnedDown($recovery, $recovery->getClosedAt() ?? $this->clock->now());
    }

    /** @return int how many lapsed: the backstop for the emails, since a read already treats a lapsed one as expired */
    public function expireDue(): int
    {
        $expired = 0;

        foreach ($this->twoFactorRecoveryRepository->findWaitingExpiredBy($this->clock->now()) as $recovery) {
            $recovery->close(TwoFactorRecoveryStatus::Expired, $this->clock->now());
            $this->auditor->record('two_factor_recovery.expired', self::SUBJECT, $recovery->getId());
            $this->entityManager->flush();
            $this->twoFactorRecoveryMailer->sendExpired($recovery);
            ++$expired;
        }

        return $expired;
    }

    /** @param callable(TwoFactorRecovery): void $effect */
    private function decide(User $approver, string $id, TwoFactorRecoveryStatus $answer, callable $effect): TwoFactorRecovery
    {
        $recovery = Uuid::isValid($id) ? $this->twoFactorRecoveryRepository->find(Uuid::fromString($id)) : null;

        // not_found rather than forbidden for anybody who may not answer it: the difference would confirm it exists.
        if (null === $recovery || !$this->mayAnswer($approver, $recovery)) {
            throw ApiException::notFound('recovery.unknown');
        }

        if ($recovery->getUser()->getId()->equals($approver->getId())) {
            throw ApiException::forbidden('recovery.own_request');
        }

        $decided = $this->entityManager->wrapInTransaction(function () use ($recovery, $approver, $answer, $effect): TwoFactorRecovery|ApiException {
            $this->entityManager->refresh($recovery, LockMode::PESSIMISTIC_WRITE);
            $now = $this->clock->now();
            $status = $recovery->statusAt($now);

            if (TwoFactorRecoveryStatus::Waiting !== $status) {
                return new ApiException(ErrorCode::RecoveryRequestClosed, 'recovery.closed', [], null, [], ['requestStatus' => $status->value]);
            }

            $effect($recovery);
            $recovery->close($answer, $now, $approver);
            $this->auditor->record(
                TwoFactorRecoveryStatus::Approved === $answer ? 'two_factor_recovery.approved' : 'two_factor_recovery.turned_down',
                self::SUBJECT,
                $recovery->getId(),
                Actor::User,
                $approver->getId(),
                $approver->getName(),
            );
            $this->entityManager->flush();

            return $recovery;
        });

        if ($decided instanceof ApiException) {
            throw $decided;
        }

        return Type\instance_of(TwoFactorRecovery::class)->coerce($decided);
    }

    private function mayAnswer(User $approver, TwoFactorRecovery $recovery): bool
    {
        return $recovery->getUser()->getId()->equals($approver->getId())
            || Iter\any(
                $this->recoveryApprovers->sharedBy($approver, $recovery->getUser()),
                // An organisation's sign-in rules hold this duty back with the rest of administration (sc-69).
                fn (Organisation $organisation): bool => $this->signInRules->leavesAdministration($approver, $organisation),
            );
    }
}
