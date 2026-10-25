<?php

declare(strict_types=1);

namespace App\Domain\User\Provider;

use App\Domain\User\Interfaces\CodeRedeemerInterface;
use App\Domain\User\Interfaces\IdTokenVerifierInterface;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Model\ProviderLink;
use App\Domain\User\Model\ProviderSignInResult;
use App\Domain\User\TwoFactor\SignInGate;
use App\Domain\User\UserRegistrar;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use App\Repository\ProviderIdentityRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
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
        private SignInGate $signInGate,
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
        ?string $suppliedName = null,
    ): ProviderSignInResult {
        $idToken = $this->codeRedeemer->redeem($provider, $code, $codeVerifier, $redirectUri);

        return $this->signIn($provider, $idToken, $rawNonce, $request, $suppliedName);
    }

    public function signIn(
        IdentityProvider $provider,
        #[SensitiveParameter]
        string $idToken,
        #[SensitiveParameter]
        ?string $rawNonce,
        ?Request $request = null,
        ?string $suppliedName = null,
    ): ProviderSignInResult {
        $claims = $this->idTokenVerifier->verify($provider, $idToken, $rawNonce);
        $known = $this->providerIdentityRepository->findOneBySubject($provider, $claims->subject);
        // Apple puts no name in its token, and gives the client one only on the very first authorisation.
        $name = $claims->name ?? self::nameOrNull($suppliedName);

        if (null !== $known) {
            self::fillBlankName($known->getUser(), $name);
            $known->vouchedFor($claims->verifiedEmail());
            $this->entityManager->flush();
            // Already linked, so the gate only records the provider on the session it starts.
            $admission = $this->signInGate->admit($known->getUser(), $request, new ProviderLink($provider, $claims->subject));

            return new ProviderSignInResult($known->getUser(), $admission, false);
        }

        // An address the provider has not verified is a self-asserted string, never an identity.
        if (null === $claims->email || !$claims->emailVerified) {
            throw new ApiException(ErrorCode::OAuthTokenInvalid, 'provider.address_unverified');
        }

        // Only an account that proved the address itself, or a password typed by somebody else would stay in.
        $owner = $this->userRepository->findOneByPrimaryEmailAddress($claims->email);

        if (null !== $owner && true === $owner->getPrimaryEmailAddress()?->isVerified()) {
            $admission = $this->signInGate->admit($owner, $request, new ProviderLink($provider, $claims->subject, $claims->verifiedEmail()));

            if (!$admission instanceof IssuedTokens) {
                // Nothing linked or named yet, and nothing said about linking, until the code passes.
                return new ProviderSignInResult($owner, $admission, false);
            }

            self::fillBlankName($owner, $name);
            $this->entityManager->flush();

            return new ProviderSignInResult($owner, $admission, true);
        }

        $registered = $this->userRegistrar->registerFromProvider($claims->email, $name, $request, $provider);
        $this->entityManager->persist(new ProviderIdentity($registered->user, $provider, $claims->subject, $claims->verifiedEmail()));
        $this->entityManager->flush();

        return new ProviderSignInResult($registered->user, $registered->tokens, false);
    }

    /** A name only ever fills a blank one: a later sign-in that brings none must not empty it. */
    private static function fillBlankName(User $user, ?string $name): void
    {
        if (null !== $name && '' === Str\trim($user->getName())) {
            $user->setName($name);
        }
    }

    private static function nameOrNull(?string $name): ?string
    {
        $trimmed = Str\trim($name ?? '');

        return '' === $trimmed ? null : $trimmed;
    }
}
