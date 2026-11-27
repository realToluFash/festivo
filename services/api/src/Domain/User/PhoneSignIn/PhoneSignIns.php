<?php

declare(strict_types=1);

namespace App\Domain\User\PhoneSignIn;

use App\Audit\Auditor;
use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Domain\User\Verification\ContactVerifier;
use App\Domain\User\Verification\PhoneCodeDispatch;
use App\Domain\User\Verification\ResendCooldown;
use App\Domain\User\Verification\VerificationCodeIssuer;
use App\Domain\User\Verification\VerificationCodeResender;
use App\Entity\PhoneNumber;
use App\Entity\PhoneSignIn;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\AccountOrigin;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\LinkTokens;
use App\Repository\PhoneNumberRepository;
use App\Repository\PhoneSignInRepository;
use App\Repository\VerificationChallengeRepository;
use Closure;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Encoding\Base64;
use Psl\Math;
use Psl\SecureRandom;
use Psl\Type;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;

/** Signing in with one code to a mobile number (sc-4235), with a phone's code, limits and route (sc-62, sc-750); no account until the code is right. */
final readonly class PhoneSignIns
{
    public const string SIGNED_IN = 'phone.signed_in';

    public const string ACCOUNT_MADE = 'phone.account_made';

    public const string ACCOUNT_LINKED = 'staff.account_linked';

    private const int HANDLE_BYTES = 24;

    public function __construct(
        private PhoneSignInRepository $phoneSignInRepository,
        private PhoneNumberRepository $phoneNumberRepository,
        private VerificationChallengeRepository $verificationChallengeRepository,
        private VerificationCodeIssuer $verificationCodeIssuer,
        private VerificationCodeResender $verificationCodeResender,
        private PhoneCodeDispatch $phoneCodeDispatch,
        private ResendCooldown $resendCooldown,
        private ContactVerifier $contactVerifier,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private SignInRules $signInRules,
        private ClockInterface $clock,
    ) {
    }

    public static function newHandle(): string
    {
        return Base64\encode(SecureRandom\bytes(self::HANDLE_BYTES), Base64\Variant::UrlSafe, padding: false);
    }

    public static function hash(#[SensitiveParameter] string $handle): string
    {
        return LinkTokens::hash($handle);
    }

    /** Refused `429` inside the number's resend cooldown, whichever way in sent its last code. */
    public function send(PhoneSignIn $signIn): void
    {
        $left = $this->secondsLeftForNumber($signIn->getNumber());

        if ($left > 0) {
            throw self::wait($left);
        }

        $this->entityManager->persist($signIn);
        $issued = $this->verificationCodeIssuer->issueFor($signIn);
        $this->entityManager->flush();
        $this->phoneCodeDispatch->send($signIn, $issued);
    }

    public function find(#[SensitiveParameter] string $handle): PhoneSignIn
    {
        $signIn = $this->phoneSignInRepository->findOneByHandleHash(self::hash($handle));

        if (null === $signIn || !$signIn->isOpenAt($this->clock->now())) {
            throw new ApiException(ErrorCode::VerificationCodeExpired, 'code.expired');
        }

        return $signIn;
    }

    public function resend(PhoneSignIn $signIn): void
    {
        $issued = $this->verificationCodeResender->resend($signIn);

        if (\is_int($issued)) {
            if ($issued > 0) {
                throw self::wait($issued);
            }

            return;
        }

        $this->phoneCodeDispatch->send($signIn, $issued);
    }

    /** @return array{cooldownSeconds: int, codeState: string, route: ?string} */
    public function state(PhoneSignIn $signIn): array
    {
        $this->phoneCodeDispatch->fallBackIfDue($signIn);

        return [
            'cooldownSeconds' => $this->resendCooldown->secondsLeftFor($signIn),
            'codeState' => $this->contactVerifier->codeState($signIn)->value,
            'route' => $this->phoneCodeDispatch->routeOf($signIn)?->value,
        ];
    }

    public function textInstead(PhoneSignIn $signIn): void
    {
        $this->phoneCodeDispatch->textInstead($signIn);
    }

    /**
     * `$admits` sees the account the number would sign into, or null for a new one, once the code is right and before anything is written; it refuses by throwing.
     * An account whose password sc-69's rule refuses is refused the code as well, after it is right and before two-factor (sc-94849); a link's entry is still linked to it.
     *
     * @param (Closure(?User): void)|null $admits
     *
     * @return array{user: User, made: bool} the account whose verified primary it is, or a new one; an alternative signs into nothing, and an unverified number elsewhere is released
     */
    public function prove(PhoneSignIn $signIn, #[SensitiveParameter] string $code, string $name, ?Request $request, ?Closure $admits = null): array
    {
        $refusal = $this->contactVerifier->attempt($signIn, $code);

        if (null !== $refusal) {
            throw $refusal;
        }

        $held = $this->phoneNumberRepository->findOneByNumber(Type\non_empty_string()->assert($signIn->getNumber()));

        if (null !== $held && $held->isVerified()) {
            if (!$held->isPrimary()) {
                $signIn->forgetTypedName();
                $this->entityManager->flush();

                throw new ApiException(ErrorCode::PhoneAlternative, 'phone_sign_in.alternative');
            }

            $this->refuseLikeAPassword($signIn, $held->getUser());
            $this->admitOrForget($signIn, $admits, $held->getUser());
            $signIn->forgetTypedName();
            $this->entityManager->flush();

            return ['user' => $held->getUser(), 'made' => false];
        }

        $this->admitOrForget($signIn, $admits, null);

        return $this->entityManager->wrapInTransaction(function () use ($signIn, $held, $name, $request): array {
            if (null !== $held) {
                $held->getUser()->removePhoneNumber($held);
                $this->entityManager->remove($held);
                $this->entityManager->flush();
            }

            $user = new User($name, null, AccountOrigin::Staff);
            $user->markDetailsSaved();
            AccountLanguage::rememberIfNone($user, $request);
            AccountTimeZone::rememberIfNone($user, $request);
            $phone = new PhoneNumber($user, $signIn->getNumber(), true, $signIn->getCountryCode());
            $phone->setVerifiedAt($this->clock->now());
            $user->addPhoneNumber($phone);
            $this->entityManager->persist($user);
            $this->entityManager->persist($phone);
            $signIn->forgetTypedName();
            $this->auditor->record(self::ACCOUNT_MADE, 'User', $user->getId(), Actor::User, $user->getId(), $user->getName());
            $this->entityManager->flush();

            return ['user' => $user, 'made' => true];
        });
    }

    /** After two-factor when it is on, and before the session is issued: the token's cap reads the link's grant by DQL, so the entry is flushed once linked. */
    public function signedIn(User $user, PhoneSignIn $signIn): void
    {
        $entry = $this->linkEntry($signIn, $user);
        $this->auditor->record(self::SIGNED_IN, 'User', $user->getId(), Actor::User, $user->getId(), $user->getName(), ['through' => [null, null === $entry ? 'door_code' : 'staff_link']]);
        $this->entityManager->flush();
    }

    private function refuseLikeAPassword(PhoneSignIn $signIn, User $user): void
    {
        $refusal = $this->signInRules->passwordRefusal($user);

        if (null === $refusal) {
            return;
        }

        $this->linkEntry($signIn, $user);
        $signIn->forgetTypedName();
        $this->entityManager->flush();

        throw $refusal;
    }

    private function linkEntry(PhoneSignIn $signIn, User $user): ?StaffMember
    {
        $entry = $signIn->getStaffMember();

        if (null !== $entry && true !== $entry->getAccount()?->getId()->equals($user->getId())) {
            $entry->linkAccount($user);
            $this->auditor->record(self::ACCOUNT_LINKED, 'StaffMember', $entry->getId(), Actor::User, $user->getId(), $user->getName(), ['account' => [null, $user->getId()->toRfc4122()]]);
        }

        return $entry;
    }

    /**
     * A refusal after the right code makes no account, so the name typed to name one is forgotten with it (Decided, 26 Nov).
     *
     * @param (Closure(?User): void)|null $admits
     */
    private function admitOrForget(PhoneSignIn $signIn, ?Closure $admits, ?User $account): void
    {
        if (null === $admits) {
            return;
        }

        try {
            $admits($account);
        } catch (ApiException $refusal) {
            $signIn->forgetTypedName();
            $this->entityManager->flush();

            throw $refusal;
        }
    }

    private function secondsLeftForNumber(string $number): int
    {
        $newest = $this->verificationChallengeRepository->findNewestForSignInNumber($number);

        if (null === $newest) {
            return 0;
        }

        $ends = $newest->getCreatedAt()->getTimestamp() + VerificationChallenge::RESEND_COOLDOWN_SECONDS;

        return Math\maxva(0, $ends - new DateTimeImmutable()->getTimestamp());
    }

    private static function wait(int $seconds): ApiException
    {
        return new ApiException(ErrorCode::TooManyAttempts, 'code.wait', [], null, ['Retry-After' => (string) $seconds]);
    }
}
