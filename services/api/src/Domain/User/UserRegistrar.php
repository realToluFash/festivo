<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Interfaces\BreachedPasswordCheckerInterface;
use App\Domain\User\Model\RegistrationResult;
use App\Domain\User\Password\PasswordPolicy;
use App\Domain\User\Password\PasswordResolver;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasswordFailure;
use App\Http\Exception\ApiException;
use App\Repository\EmailAddressRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class UserRegistrar
{
    public function __construct(
        private EmailAddressRepository $emailAddressRepository,
        private PasswordResolver $passwordResolver,
        private BreachedPasswordCheckerInterface $breachedPasswordChecker,
        private TokenIssuer $tokenIssuer,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    public function register(
        string $email,
        string $name,
        #[SensitiveParameter]
        string $password,
        ?Request $request = null,
    ): RegistrationResult {
        $user = $this->build($email, $name, $password);

        return $this->persist($user, $request);
    }

    /**
     * The address arrives verified: the token reached this person at this
     * address, which is what a verification code proves. A phone is not, since
     * nothing was sent to one.
     */
    public function registerFromInvitation(
        string $email,
        string $name,
        #[SensitiveParameter]
        string $password,
        ?Request $request = null,
    ): RegistrationResult {
        $user = $this->build($email, $name, $password);
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());

        return $this->persist($user, $request);
    }

    private function build(string $email, string $name, #[SensitiveParameter] string $password): User
    {
        $normalised = EmailAddressNormaliser::normalise($email);

        $this->validate($normalised, $name, $password);

        $user = new User(Str\trim($name), $this->passwordResolver->hash($password));

        // Registering with an address makes it the primary one. The constructor
        // registers itself with the user, so nothing else has to remember to.
        new EmailAddress($user, Type\non_empty_string()->assert($normalised), isPrimary: true);

        return $user;
    }

    /**
     * Every violation at once, rather than the first one found: a form that
     * reports one bad field per submit makes somebody guess how many more
     * there are.
     */
    private function validate(string $email, string $name, #[SensitiveParameter] string $password): void
    {
        $violations = [];

        if (!\filter_var($email, \FILTER_VALIDATE_EMAIL)) {
            $violations[] = $this->violation('email', 'validation.email_invalid', ErrorCode::ValidationFailed->value);
        }

        if ('' === Str\trim($name)) {
            $violations[] = $this->violation('name', 'validation.name_required', ErrorCode::ValidationFailed->value);
        }

        $failures = PasswordPolicy::check($password);

        // The corpus is asked only once the length rule passes. There is no
        // reason to spend a network call on a password that is already refused.
        if ([] === $failures && $this->breachedPasswordChecker->isBreached($password)) {
            $failures[] = PasswordFailure::Breached;
        }

        foreach ($failures as $failure) {
            $violations[] = $this->violation('password', 'validation.' . $failure->value, $failure->value, [
                '{count}' => match ($failure) {
                    PasswordFailure::TooShort => (string) PasswordPolicy::MINIMUM_LENGTH,
                    PasswordFailure::TooLong => (string) PasswordPolicy::MAXIMUM_LENGTH,
                    PasswordFailure::Breached => '',
                },
            ]);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        // Every address, not only the primary one. Registering with somebody
        // else's alternative address has to be refused with the same clean 409
        // as registering with their primary one, rather than reaching the
        // unique constraint.
        if (null !== $this->emailAddressRepository->findOneByAddress($email)) {
            throw new ApiException(ErrorCode::EmailTaken, 'That email address is already registered.');
        }
    }

    private function persist(User $user, ?Request $request): RegistrationResult
    {
        $this->entityManager->persist($user);
        $tokens = $this->tokenIssuer->issueFor($user, $request);

        try {
            $this->entityManager->flush();
        } catch (UniqueConstraintViolationException $e) {
            // The read in validate() cannot see a registration that lands
            // between it and this write, so the constraint is the real guard
            // and this turns it back into the same answer.
            throw new ApiException(
                ErrorCode::EmailTaken,
                'That email address is already registered.',
                [],
                $e,
            );
        }

        return new RegistrationResult($user, $tokens);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, string $code, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => $code,
        ];
    }
}
