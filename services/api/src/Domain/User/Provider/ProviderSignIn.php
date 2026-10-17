<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

use App\Domain\User\Interfaces\CodeRedeemerInterface;
use App\Domain\User\Interfaces\IdTokenVerifierInterface;
use App\Domain\User\Model\ProviderSignInResult;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\ProviderIdentity;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use App\Repository\ProviderIdentityRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** The three ways in: an identity seen before, an account it proves it owns, or a new account. */
final readonly class ProviderSignIn
{
    public function __construct(
        private IdTokenVerifierInterface $idTokenVerifier,
        private CodeRedeemerInterface $codeRedeemer,
        private ProviderIdentityRepository $providerIdentityRepository,
        private UserRepository $userRepository,
        private UserRegistrar $userRegistrar,
        private TokenIssuer $tokenIssuer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The web's way in: its code redeemed by the API, then the same checks and paths as a token. */
    public function signInWithCode(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $code,
        #[SensitiveParameter]
        string $codeVerifier,
        string $redirectUri,
        #[SensitiveParameter]
        ?string $rawNonce,
        ?Request $request = null,
    ): ProviderSignInResult {
        $idToken = $this->codeRedeemer->redeem($provider, $code, $codeVerifier, $redirectUri);

        return $this->signIn($provider, $idToken, $rawNonce, $request);
    }

    public function signIn(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $idToken,
        #[SensitiveParameter]
        ?string $rawNonce,
        ?Request $request = null,
    ): ProviderSignInResult {
        $claims = $this->idTokenVerifier->verify($provider, $idToken, $rawNonce);
        $known = $this->providerIdentityRepository->findOneBySubject($provider, $claims->subject);

        if (null !== $known) {
            $tokens = $this->tokenIssuer->issueFor($known->getUser(), $request);
            $this->entityManager->flush();

            return new ProviderSignInResult($known->getUser(), $tokens, false);
        }

        // An address the provider has not verified is a self-asserted string, never an identity.
        if (null === $claims->email || !$claims->emailVerified) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'That sign-in did not come with a verified address.');
        }

        // Only an account that proved the address itself, or a password typed by somebody else would stay in.
        $owner = $this->userRepository->findOneByPrimaryEmailAddress($claims->email);

        if (null !== $owner && true === $owner->getPrimaryEmailAddress()?->isVerified()) {
            $this->entityManager->persist(new ProviderIdentity($owner, $provider, $claims->subject));
            $tokens = $this->tokenIssuer->issueFor($owner, $request);
            $this->entityManager->flush();

            return new ProviderSignInResult($owner, $tokens, true);
        }

        $registered = $this->userRegistrar->registerFromProvider($claims->email, $claims->name, $request);
        $this->entityManager->persist(new ProviderIdentity($registered->user, $provider, $claims->subject));
        $this->entityManager->flush();

        return new ProviderSignInResult($registered->user, $registered->tokens, false);
    }
}
