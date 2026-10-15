<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Password\PasswordResolver;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

final readonly class UserAuthenticator
{
    public function __construct(
        private UserRepository $userRepository,
        private PasswordResolver $passwordResolver,
        private TokenIssuer $tokenIssuer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function signIn(
        string $email,
        #[SensitiveParameter]
        string $password,
        ?Request $request = null,
    ): IssuedTokens {
        $user = $this->userRepository->findOneByPrimaryEmailAddress($email);

        if (null === $user) {
            $this->passwordResolver->verifyAgainstNothing($password);

            throw $this->refuse();
        }

        if (!$this->passwordResolver->verify($user, $password)) {
            throw $this->refuse();
        }

        $tokens = $this->tokenIssuer->issueFor($user, $request);

        $this->entityManager->flush();

        return $tokens;
    }

    private function refuse(): ApiException
    {
        return new ApiException(ErrorCode::InvalidCredentials, 'That email and password do not match.');
    }
}
