<?php

declare(strict_types=1);

namespace App\Domain\User\Recovery;

use App\Domain\User\Device\KnownDevices;
use App\Domain\User\Model\SignInResult;
use App\Domain\User\Password\NewPasswordRules;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\SecondFactorCheck;
use App\Entity\PasswordResetToken;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\PasswordResetTokenRepository;
use App\Repository\ProviderIdentityRepository;
use App\Repository\TwoFactorFactorRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** Forgotten password to a new one: a single-use link, every session ended, and this device signed in. */
final readonly class PasswordRecovery
{
    private const int TOKEN_BYTES = 32;

    public function __construct(
        private UserRepository $userRepository,
        private PasswordResetTokenRepository $passwordResetTokenRepository,
        private ProviderIdentityRepository $providerIdentityRepository,
        private NewPasswordRules $newPasswordRules,
        private PasswordResolver $passwordResolver,
        private TokenIssuer $tokenIssuer,
        private KnownDevices $knownDevices,
        private RecoveryMailer $recoveryMailer,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private SecondFactorCheck $secondFactorCheck,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** Says nothing either way: what happens next is only ever in the inbox, so the caller cannot tell. */
    public function request(string $email, ?string $locale = null): void
    {
        $user = $this->userRepository->findOneByPrimaryEmailAddress($email);

        if (null === $user) {
            return;
        }

        if (null === $user->getPassword()) {
            $this->recoveryMailer->sendHowYouSignIn($user, $this->providerNames($user), $locale);

            return;
        }

        $plain = \bin2hex(SecureRandom\bytes(self::TOKEN_BYTES));
        $this->entityManager->persist(new PasswordResetToken($user, TokenIssuer::hash($plain), $this->clock->now()));
        $this->entityManager->flush();

        $this->recoveryMailer->sendLink($user, $plain, $locale);
    }

    /** Whose link this is, so the page can say "For <address>", or why it no longer works. */
    public function check(#[SensitiveParameter] string $token): User
    {
        return $this->usable($token)->getUser();
    }

    /** Whether this link needs a code before the new password: the account has two-factor on. */
    public function asksForSecondFactor(User $user): bool
    {
        return null !== $this->twoFactorFactorRepository->findActiveFor($user);
    }

    /** The code comes first, so a link alone cannot change the password or end a session. */
    public function passSecondFactor(
        #[SensitiveParameter]
        string $token,
        #[SensitiveParameter]
        ?string $code,
        #[SensitiveParameter]
        ?string $recoveryCode,
    ): void {
        $reset = $this->usable($token);
        $factor = $this->twoFactorFactorRepository->findActiveFor($reset->getUser())
            ?? throw new ApiException(ErrorCode::TwoFactorOff, 'Two-factor is not on.');

        match (true) {
            null !== $code => $this->secondFactorCheck->passCode($factor, $code),
            null !== $recoveryCode => $this->secondFactorCheck->passRecoveryCode($factor, $recoveryCode),
            default => throw new ApiException(ErrorCode::BadRequest, 'Send a code or a recoveryCode.'),
        };

        $reset->passedSecondFactor($this->clock->now());
        $this->entityManager->flush();
    }

    public function reset(#[SensitiveParameter] string $token, #[SensitiveParameter] string $password, ?Request $request = null): SignInResult
    {
        $reset = $this->usable($token);
        $violations = $this->newPasswordRules->violations($password);

        // A refused password leaves the link usable and the old password in place.
        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        $user = $reset->getUser();
        $now = $this->clock->now();

        if ($this->asksForSecondFactor($user) && !$reset->hasPassedSecondFactor()) {
            throw new ApiException(ErrorCode::TwoFactorRequired, 'Enter the code from your authenticator app first.');
        }

        $user->setPassword($this->passwordResolver->hash($password));
        $reset->markUsed($now);
        $this->entityManager->flush();

        $this->passwordResetTokenRepository->spendAllFor($user, $now);
        $this->tokenIssuer->revokeAllFor($user);
        $tokens = $this->tokenIssuer->issueFor($user, $request);
        $this->entityManager->flush();

        if (null !== $request) {
            $this->knownDevices->remember($user, $request);
        }

        $this->recoveryMailer->sendChanged($user, $now);

        return new SignInResult($user, $tokens);
    }

    private function usable(#[SensitiveParameter] string $token): PasswordResetToken
    {
        $reset = '' === $token ? null : $this->passwordResetTokenRepository->findOneByHash(TokenIssuer::hash($token));

        if (null === $reset) {
            throw new ApiException(ErrorCode::ResetLinkInvalid, 'That reset link is not one Soirely sent.');
        }

        if ($reset->isUsed()) {
            throw new ApiException(ErrorCode::ResetLinkUsed, 'This link has already been used.');
        }

        if ($reset->isExpiredAt($this->clock->now())) {
            throw new ApiException(ErrorCode::ResetLinkExpired, 'This link has expired.');
        }

        return $reset;
    }

    /** @return list<string> */
    private function providerNames(User $user): array
    {
        $names = Vec\map(
            $this->providerIdentityRepository->findBy(['user' => $user]),
            static fn (ProviderIdentity $identity): string => Str\capitalize($identity->getProvider()->value),
        );

        return [] === $names ? ['Google', 'Apple'] : Vec\unique($names);
    }
}
