<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Model\RegistrationResult;
use App\Domain\User\Password\NewPasswordRules;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeMailer;
use App\Entity\EmailAddress;
use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
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
        private NewPasswordRules $newPasswordRules,
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
        $user = $this->build($email, $name, $password, AccountOrigin::SelfRegistered);

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
        $user = $this->build($email, $name, $password, AccountOrigin::Invitation);
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());

        return $this->persist($user, $request);
    }

    /** No password and no code: the provider vouched for the address, and the name is theirs if they gave one. */
    public function registerFromProvider(string $email, ?string $name, ?Request $request = null, ?IdentityProvider $provider = null): RegistrationResult
    {
        $normalised = EmailAddressNormaliser::normalise($email);

        if (!\filter_var($normalised, \FILTER_VALIDATE_EMAIL)) {
            throw ApiException::validation([
                $this->violation('email', 'validation.email_invalid', ErrorCode::ValidationFailed->value),
            ]);
        }

        $user = new User(Str\trim($name ?? ''), null, AccountOrigin::SelfRegistered);
        $address = new EmailAddress($user, Type\non_empty_string()->assert($normalised), isPrimary: true);
        $address->setVerifiedAt(new DateTimeImmutable());

        return $this->persist($user, $request, $provider);
    }

    /**
     * The account a sign-up's code just proved: its address verified, its password the one typed then.
     */
    public function registerConfirmed(string $email, string $name, string $passwordHash, ?Request $request = null, ?string $locale = null): RegistrationResult
    {
        $user = new User(Str\trim($name), $passwordHash, AccountOrigin::SelfRegistered);
        // The language the sign-up was started in, which the code may well be entered from another device.
        $user->setLocale(null === $locale ? null : AccountLanguage::fromRequest($locale));
        $address = new EmailAddress($user, Type\non_empty_string()->assert($email), isPrimary: true);
        $address->setVerifiedAt(new DateTimeImmutable());

        return $this->persist($user, $request);
    }

    /** @return string the normalised address, once every field is fit to register with */
    public function validated(string $email, string $name, #[SensitiveParameter] string $password): string
    {
        $normalised = EmailAddressNormaliser::normalise($email);
        $this->validate($normalised, $name, $password);

        return $normalised;
    }

    /** Held by an account that has proved an address: an unverified holder holds nothing. */
    public function isTaken(string $normalisedEmail): bool
    {
        return true === $this->emailAddressRepository->findOneByAddress($normalisedEmail)?->getUser()->hasVerifiedEmailAddress();
    }

    private function build(
        string $email,
        string $name,
        #[SensitiveParameter]
        string $password,
        AccountOrigin $origin,
    ): User {
        $normalised = EmailAddressNormaliser::normalise($email);

        $this->validate($normalised, $name, $password);

        $user = new User(Str\trim($name), $this->passwordResolver->hash($password), $origin);

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

        $violations = [...$violations, ...$this->newPasswordRules->violations($password)];

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }
    }

    private function persist(User $user, ?Request $request, ?IdentityProvider $signedInWith = null): RegistrationResult
    {
        $address = $user->getPrimaryEmailAddress();

        AccountLanguage::rememberIfNone($user, $request);
        AccountTimeZone::rememberIfNone($user, $request);

        try {
            $tokens = $this->entityManager->wrapInTransaction(function () use ($user, $address, $request, $signedInWith): IssuedTokens {
                if (null !== $address) {
                    $this->releaseFromUnverifiedHolder($address->getAddress());
                }

                $this->entityManager->persist($user);
                $tokens = $this->tokenIssuer->issueFor($user, $request, $signedInWith);
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
        // Reached only by an invitation or a race: a password sign-up never says an address is taken (sc-512).
        return new ApiException(ErrorCode::Conflict, 'That email address cannot be used.', [], $previous);
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
