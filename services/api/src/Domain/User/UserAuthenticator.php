<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Model\SignInResult;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Domain\User\TwoFactor\SignInGate;
use App\Entity\ProviderIdentity;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\ProviderIdentityRepository;
use App\Repository\UserRepository;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

final readonly class UserAuthenticator
{
    public function __construct(
        private UserRepository $userRepository,
        private PasswordResolver $passwordResolver,
        private SignInGate $signInGate,
        private SignInRules $signInRules,
        private ProviderIdentityRepository $providerIdentityRepository,
    ) {
    }

    public function signIn(
        string $email,
        #[SensitiveParameter]
        string $password,
        ?Request $request = null,
    ): SignInResult {
        $user = $this->userRepository->findOneByPrimaryEmailAddress($email);

        if (null === $user) {
            $this->passwordResolver->verifyAgainstNothing($password);

            throw $this->refuse();
        }

        if (!$this->passwordResolver->verify($user, $password)) {
            throw $this->refuse();
        }

        // After the password, so the refusal tells nobody but its owner that the account belongs to the organisation.
        $this->refuseUnderRule($user);

        // An account from before sc-852 or sc-868 learns its language and zone here, as at its next request.
        AccountLanguage::rememberIfNone($user, $request);
        AccountTimeZone::rememberIfNone($user, $request);

        return new SignInResult($user, $this->signInGate->admit($user, $request));
    }

    private function refuseUnderRule(User $user): void
    {
        $organisation = $this->signInRules->refusingPassword($user);

        if (null === $organisation) {
            return;
        }

        throw new ApiException(
            ErrorCode::OAuthOnly,
            'This organisation signs in with Google or Apple only.',
            [],
            null,
            [],
            [
                'organisation' => $organisation->getName(),
                'providers' => Vec\map(
                    $this->providerIdentityRepository->findBy(['user' => $user], ['provider' => 'ASC']),
                    static fn (ProviderIdentity $identity): string => $identity->getProvider()->value,
                ),
            ],
        );
    }

    private function refuse(): ApiException
    {
        return new ApiException(ErrorCode::InvalidCredentials, 'That email and password do not match.');
    }
}
