<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Interfaces\BreachedPasswordCheckerInterface;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Model\RegistrationResult;
use App\Domain\User\Password\PasswordPolicy;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeMailer;
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
use Throwable;

final readonly class UserRegistrar
{
    public function __construct(
        private EmailAddressRepository $emailAddressRepository,
        private PasswordResolver $passwordResolver,
        private BreachedPasswordCheckerInterface $breachedPasswordChecker,
        private TokenIssuer $tokenIssuer,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private VerificationCodeMailer $verificationCodeMailer,
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
    }

    private function persist(User $user, ?Request $request): RegistrationResult
    {
        $address = $user->getPrimaryEmailAddress();

        try {
            $tokens = $this->entityManager->wrapInTransaction(function () use ($user, $address, $request): IssuedTokens {
                if (null !== $address) {
                    $this->releaseFromUnverifiedHolder($address->getAddress());
                }

                $this->entityManager->persist($user);
                $tokens = $this->tokenIssuer->issueFor($user, $request);
                $this->entityManager->flush();

                return $tokens;
            });
        } catch (UniqueConstraintViolationException $e) {
            // A registration landing after the read above: the constraint is the real guard.
            throw self::taken($e);
        }

        if (null !== $address && !$address->isVerified()) {
            $code = $this->verificationCodeIssuer->issueFor($address);
            $this->entityManager->flush();
            $this->verificationCodeMailer->send($address, $code->code);
        }

        return new RegistrationResult($user, $tokens);
    }

    /** Any address counts, alternatives included; an account that never verified one owns nothing. */
    private function releaseFromUnverifiedHolder(string $address): void
    {
        $held = $this->emailAddressRepository->findOneByAddress($address);

        if (null === $held) {
            return;
        }

        if ($held->getUser()->hasVerifiedEmailAddress()) {
            throw self::taken();
        }

        // Flushed on its own: Doctrine inserts before it deletes, and the new row needs the address free.
        $this->entityManager->remove($held->getUser());
        $this->entityManager->flush();
    }

    private static function taken(?Throwable $previous = null): ApiException
    {
        return new ApiException(ErrorCode::EmailTaken, 'That email address is already registered.', [], $previous);
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
