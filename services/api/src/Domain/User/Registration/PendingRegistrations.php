<?php

declare(strict_types=1);

namespace App\Domain\User\Registration;

use App\Domain\User\Model\RegistrationResult;
use App\Domain\User\Password\PasswordResolver;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Entity\PendingRegistration;
use App\Enum\CodeState;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\PendingRegistrationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\SecureRandom;
use Psl\Str;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Throwable;

/** A password sign-up answered alike for every address; a taken one gets a code nobody is sent. */
final readonly class PendingRegistrations
{
    private const int HANDLE_BYTES = 32;

    public function __construct(
        private PendingRegistrationRepository $pendingRegistrationRepository,
        private UserRegistrar $userRegistrar,
        private PasswordResolver $passwordResolver,
        private RegistrationMail $registrationMail,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** @return string the handle for "Check your email", the same in shape for every address */
    public function start(string $email, string $name, #[SensitiveParameter] string $password, ?string $locale): string
    {
        $address = $this->userRegistrar->validated($email, $name, $password);
        // Hashed either way: a taken address must cost what a new one does.
        $passwordHash = $this->passwordResolver->hash($password);
        $taken = $this->userRegistrar->isTaken($address);
        $now = $this->clock->now();

        $handle = \bin2hex(SecureRandom\bytes(self::HANDLE_BYTES));
        $pending = new PendingRegistration(TokenIssuer::hash($handle), $address, Str\trim($name), $taken ? null : $passwordHash, $locale, $taken, $now);
        $this->entityManager->persist($pending);
        $this->sendCode($pending);
        $this->entityManager->flush();

        return $handle;
    }

    public function verify(#[SensitiveParameter] string $handle, #[SensitiveParameter] string $code, ?Request $request = null): RegistrationResult
    {
        $id = $this->open($handle)->getId();
        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            // Held until the account exists, so a second press of the same code finds nothing left.
            $pending = $this->pendingRegistrationRepository->findForUpdate($id)
                ?? throw new ApiException(ErrorCode::RegistrationExpired, 'registration.expired');
            $this->check($pending, $code);

            $result = $this->userRegistrar->registerConfirmed($pending->getEmail(), $pending->getName(), (string) $pending->getPasswordHash(), $request, $pending->getLocale());
            $this->entityManager->remove($pending);
            $this->entityManager->flush();
            $connection->commit();

            return $result;
        } catch (ApiException $refusal) {
            // A refused code is kept: the attempt it cost has to count.
            $connection->commit();

            throw $refusal;
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }
    }

    /** @return array{cooldownSeconds: int, codeState: CodeState} what the screen opens on, in the order a try checks */
    public function opening(#[SensitiveParameter] string $handle): array
    {
        $pending = $this->open($handle);
        $now = $this->clock->now();

        return [
            'cooldownSeconds' => $pending->secondsUntilResendAt($now),
            'codeState' => match (true) {
                $pending->isCodeExpiredAt($now) => CodeState::Expired,
                $pending->isExhausted() => CodeState::Exhausted,
                default => CodeState::Live,
            },
        ];
    }

    /** @return int|null seconds still to wait, or null once a new code (or the email) is on its way */
    public function resend(#[SensitiveParameter] string $handle): ?int
    {
        $pending = $this->open($handle);
        $wait = $pending->secondsUntilResendAt($this->clock->now());

        if ($wait > 0) {
            return $wait;
        }

        $this->sendCode($pending);
        $this->entityManager->flush();

        return null;
    }

    /** One rule for both: a new code; the address hears it, or, when taken, hears it already has an account. */
    private function sendCode(PendingRegistration $pending): void
    {
        $now = $this->clock->now();
        $code = VerificationCodeIssuer::generate();
        $pending->newCode(VerificationCodeIssuer::hash($code), $now);

        if (!$pending->isForTakenAddress()) {
            $this->registrationMail->code($pending->getEmail(), $pending->getLocale(), $code);

            return;
        }

        $since = $now->modify('-' . PendingRegistration::ALREADY_REGISTERED_EMAIL_MINUTES . ' minutes');

        if (!$this->pendingRegistrationRepository->alreadyRegisteredEmailedSince($pending->getEmail(), $since)) {
            $pending->alreadyRegisteredEmailed($now);
            $this->registrationMail->alreadyRegistered($pending->getEmail(), $pending->getLocale());
        }
    }

    /** sc-56's rules, word for word, so a taken address's answers cannot be told from a real one's. */
    private function check(PendingRegistration $pending, #[SensitiveParameter] string $code): void
    {
        $now = $this->clock->now();

        if ('' === Str\trim($code)) {
            throw new ApiException(ErrorCode::VerificationCodeInvalid, 'code.mismatch');
        }

        if ($pending->isCodeExpiredAt($now)) {
            throw new ApiException(ErrorCode::VerificationCodeExpired, 'code.expired');
        }

        if ($pending->isExhausted()) {
            throw new ApiException(ErrorCode::VerificationCodeExhausted, 'code.exhausted');
        }

        if ($pending->isForTakenAddress() || !\hash_equals($pending->getCodeHash(), VerificationCodeIssuer::hash(Str\trim($code)))) {
            $pending->wrongAttempt();
            $this->entityManager->flush();

            throw $pending->isExhausted()
                ? new ApiException(ErrorCode::VerificationCodeExhausted, 'code.exhausted')
                : new ApiException(ErrorCode::VerificationCodeInvalid, 'code.mismatch');
        }
    }

    private function open(#[SensitiveParameter] string $handle): PendingRegistration
    {
        $pending = '' === $handle ? null : $this->pendingRegistrationRepository->findOneByHandleHash(TokenIssuer::hash($handle));

        if (null === $pending || !$pending->isOpenAt($this->clock->now())) {
            throw new ApiException(ErrorCode::RegistrationExpired, 'registration.expired');
        }

        return $pending;
    }
}
