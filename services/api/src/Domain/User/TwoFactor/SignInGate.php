<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\User\Device\KnownDevices;
use App\Domain\User\Model\IssuedChallenge;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Model\ProviderLink;
use App\Domain\User\Model\SecondFactorAnswer;
use App\Domain\User\Model\TwoFactorSignInResult;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\Passkey\Passkeys;
use App\Entity\ProviderIdentity;
use App\Entity\TwoFactorChallenge;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasskeyStep;
use App\Http\Exception\ApiException;
use App\Repository\ProviderIdentityRepository;
use App\Repository\TwoFactorChallengeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** Where an existing account is let in, and a provider linked to it. With two-factor on, a challenge comes back first. */
final readonly class SignInGate
{
    private const int CHALLENGE_BYTES = 32;

    public function __construct(
        private SecondFactors $secondFactors,
        private Passkeys $passkeys,
        private TwoFactorChallengeRepository $twoFactorChallengeRepository,
        private ProviderIdentityRepository $providerIdentityRepository,
        private SecondFactorCheck $secondFactorCheck,
        private TokenIssuer $tokenIssuer,
        private KnownDevices $knownDevices,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    public function admit(User $user, ?Request $request = null, ?ProviderLink $link = null): IssuedTokens|IssuedChallenge
    {
        if (!$this->secondFactors->isOn($user)) {
            $this->link($user, $link);

            return $this->issue($user, $request, $link);
        }

        $plain = \bin2hex(SecureRandom\bytes(self::CHALLENGE_BYTES));
        $challenge = new TwoFactorChallenge($user, TokenIssuer::hash($plain), $this->clock->now(), $link?->provider, $link?->subject);
        $this->entityManager->persist($challenge);
        $this->entityManager->flush();

        return new IssuedChallenge($plain, $challenge->getExpiresAt(), $this->secondFactors->kinds($user));
    }

    /**
     * The options the sheet opens with at sign-in, each time with a new challenge.
     *
     * @return array<string, mixed>
     */
    public function passkeyOptions(#[SensitiveParameter] string $token): array
    {
        return $this->passkeys->requestOptions($this->open($token)->getUser(), PasskeyStep::SignIn);
    }

    public function complete(#[SensitiveParameter] string $token, SecondFactorAnswer $answer, ?Request $request = null): TwoFactorSignInResult
    {
        $challenge = $this->open($token);
        $user = $challenge->getUser();

        // Turned off since the challenge was made: the first factor still has to be repeated.
        if (!$this->secondFactors->isOn($user)) {
            throw new ApiException(ErrorCode::TwoFactorChallengeInvalid, 'sign_in.again');
        }

        $this->secondFactorCheck->pass($user, $answer, PasskeyStep::SignIn);

        $challenge->markUsed($this->clock->now());
        $provider = $challenge->getLinkProvider();
        $subject = $challenge->getLinkSubject();
        // A link waits on the code only for sc-58's matching address, so the primary is the one the provider vouched for.
        $link = null === $provider || null === $subject ? null : new ProviderLink($provider, $subject, $user->getPrimaryEmailAddress()?->getAddress());
        $linked = $this->link($user, $link);

        return new TwoFactorSignInResult($user, $this->issue($user, $request, $link), $linked);
    }

    private function open(#[SensitiveParameter] string $token): TwoFactorChallenge
    {
        $challenge = $this->twoFactorChallengeRepository->findOneByHash(TokenIssuer::hash($token));

        if (null === $challenge || !$challenge->isOpenAt($this->clock->now())) {
            throw new ApiException(ErrorCode::TwoFactorChallengeInvalid, 'sign_in.again');
        }

        return $challenge;
    }

    /** False when there is nothing to link, or a sign-in that passed first already linked it. */
    private function link(User $user, ?ProviderLink $link): bool
    {
        if (null === $link || null !== $this->providerIdentityRepository->findOneBySubject($link->provider, $link->subject)) {
            return false;
        }

        $this->entityManager->persist(new ProviderIdentity($user, $link->provider, $link->subject, $link->email));

        return true;
    }

    private function issue(User $user, ?Request $request, ?ProviderLink $link): IssuedTokens
    {
        $tokens = $this->tokenIssuer->issueFor($user, $request, $link?->provider);
        $this->entityManager->flush();

        if (null !== $request) {
            $this->knownDevices->signedIn($user, $request);
        }

        return $tokens;
    }
}
