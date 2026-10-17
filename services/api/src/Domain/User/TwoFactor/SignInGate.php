<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Model\IssuedChallenge;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Model\TwoFactorSignInResult;
use App\Domain\User\TokenIssuer;
use App\Entity\TwoFactorChallenge;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\TwoFactorChallengeRepository;
use App\Repository\TwoFactorFactorRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** Where an existing account is let in. With two-factor on, a challenge comes back instead of tokens. */
final readonly class SignInGate
{
    private const int CHALLENGE_BYTES = 32;

    public function __construct(
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private TwoFactorChallengeRepository $twoFactorChallengeRepository,
        private SecondFactorCheck $secondFactorCheck,
        private TokenIssuer $tokenIssuer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function admit(User $user, ?Request $request = null): IssuedTokens|IssuedChallenge
    {
        if (null === $this->twoFactorFactorRepository->findActiveFor($user)) {
            return $this->issue($user, $request);
        }

        $plain = \bin2hex(SecureRandom\bytes(self::CHALLENGE_BYTES));
        $challenge = new TwoFactorChallenge($user, TokenIssuer::hash($plain), $this->clock->now());
        $this->entityManager->persist($challenge);
        $this->entityManager->flush();

        return new IssuedChallenge($plain, $challenge->getExpiresAt());
    }

    /** Exactly one of a code from the app or a recovery code. */
    public function complete(
        #[SensitiveParameter]
        string $token,
        #[SensitiveParameter]
        ?string $code,
        #[SensitiveParameter]
        ?string $recoveryCode,
        ?Request $request = null,
    ): TwoFactorSignInResult {
        $challenge = $this->twoFactorChallengeRepository->findOneByHash(TokenIssuer::hash($token));
        $now = $this->clock->now();

        if (null === $challenge || !$challenge->isOpenAt($now)) {
            throw new ApiException(ErrorCode::TwoFactorChallengeInvalid, 'Sign in again.');
        }

        $user = $challenge->getUser();
        // Turned off since the challenge was made: the first factor still has to be repeated.
        $factor = $this->twoFactorFactorRepository->findActiveFor($user)
            ?? throw new ApiException(ErrorCode::TwoFactorChallengeInvalid, 'Sign in again.');

        match (true) {
            null !== $code => $this->secondFactorCheck->passCode($factor, $code),
            null !== $recoveryCode => $this->secondFactorCheck->passRecoveryCode($factor, $recoveryCode),
            default => throw new ApiException(ErrorCode::BadRequest, 'Send a code or a recoveryCode.'),
        };

        $challenge->markUsed($now);

        return new TwoFactorSignInResult($user, $this->issue($user, $request));
    }

    private function issue(User $user, ?Request $request): IssuedTokens
    {
        $tokens = $this->tokenIssuer->issueFor($user, $request);
        $this->entityManager->flush();

        return $tokens;
    }
}
