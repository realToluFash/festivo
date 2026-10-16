<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Phone\PhoneNumberParser;
use App\Domain\User\Phone\PrimaryPhoneSetter;
use App\Domain\User\Verification\ContactVerifier;
use App\Domain\User\Verification\ResendCooldown;
use App\Domain\User\Verification\VerificationCodeResender;
use App\Domain\User\Verification\VerificationCodeSender;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The primary phone: set or changed, then proved by a text, under the same rules as an email address. */
#[Authenticated]
final readonly class PhoneController
{
    public function __construct(
        private Security $security,
        private PhoneNumberParser $phoneNumberParser,
        private PrimaryPhoneSetter $primaryPhoneSetter,
        private ContactVerifier $contactVerifier,
        private VerificationCodeResender $verificationCodeResender,
        private VerificationCodeSender $verificationCodeSender,
        private ResendCooldown $resendCooldown,
    ) {
    }

    /** A new number is texted a code at once, and the old one stops counting as soon as it is. */
    #[Route('/api/auth/phone', name: 'auth_phone_set', methods: ['PUT'])]
    public function set(Request $request): JsonResponse
    {
        $user = $this->user();
        $body = Input::body($request, Type\shape([
            'countryCode' => Type\string(),
            'number' => Type\string(),
        ]));

        $phone = $this->phoneNumberParser->parse($body['number'], $body['countryCode']);
        $texted = $this->primaryPhoneSetter->set($user, $phone);
        $awaiting = $user->getPhoneNumberAwaitingCode();

        return new JsonResponse([
            'phone' => null === $awaiting ? null : self::serialised($awaiting),
            'verificationNeeded' => null !== $awaiting && !$awaiting->isVerified(),
            'cooldownSeconds' => null === $texted ? 0 : VerificationChallenge::RESEND_COOLDOWN_SECONDS,
        ]);
    }

    #[Route('/api/auth/verify/phone', name: 'auth_verify_phone', methods: ['POST'])]
    public function verify(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['code' => Type\string()]));
        $phone = $this->phone();

        $refusal = $this->contactVerifier->attempt($phone, $body['code']);

        if (null !== $refusal) {
            throw $refusal;
        }

        $this->primaryPhoneSetter->verified($phone);

        return new JsonResponse(self::serialised($phone));
    }

    #[Route('/api/auth/verify/phone/resend', name: 'auth_verify_phone_resend_cooldown', methods: ['GET'])]
    public function cooldown(): JsonResponse
    {
        return new JsonResponse(['cooldownSeconds' => $this->resendCooldown->secondsLeftFor($this->phone())]);
    }

    #[Route('/api/auth/verify/phone/resend', name: 'auth_verify_phone_resend', methods: ['POST'])]
    public function resend(): JsonResponse
    {
        $phone = $this->phone();
        $issued = $this->verificationCodeResender->resend($phone);

        if (0 === $issued) {
            return new JsonResponse(['cooldownSeconds' => 0]);
        }

        if (\is_int($issued)) {
            throw new ApiException(
                ErrorCode::TooManyAttempts,
                'Wait before asking for another code.',
                [],
                null,
                ['Retry-After' => (string) $issued],
            );
        }

        $this->verificationCodeSender->send($phone, $issued->code);

        return new JsonResponse(['cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    /** @return array<string, mixed> */
    private static function serialised(PhoneNumber $phone): array
    {
        return [
            'id' => $phone->getId()->toRfc4122(),
            'number' => $phone->getNumber(),
            'countryCode' => $phone->getCountryCode(),
            'verified' => $phone->isVerified(),
            'primary' => $phone->isPrimary(),
            'pending' => $phone->isPending(),
        ];
    }

    private function phone(): PhoneNumber
    {
        return $this->user()->getPhoneNumberAwaitingCode()
            ?? throw ApiException::notFound('This account has no phone number.');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
        }

        return $user;
    }
}
