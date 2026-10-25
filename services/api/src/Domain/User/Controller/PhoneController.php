<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Phone\PhoneNumberParser;
use App\Domain\User\Phone\PrimaryPhoneSetter;
use App\Domain\User\Verification\ContactVerifier;
use App\Domain\User\Verification\PhoneCodeDispatch;
use App\Domain\User\Verification\ResendCooldown;
use App\Domain\User\Verification\VerificationCodeResender;
use App\Domain\User\Verification\VerificationCodeSender;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Enum\PhoneCodeRoute;
use App\Http\Access\Policy\Authenticated;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Iter;
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
        private PhoneCodeDispatch $phoneCodeDispatch,
        private ResendCooldown $resendCooldown,
        private CodeField $codeField,
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
        $body = Input::body($request, Type\shape(['code' => Type\optional(Type\mixed()), 'phone' => Type\optional(Type\string())]));
        $code = $this->codeField->required($body, 'code', CodeField::FROM_TEXT);
        $phone = $this->phone($body['phone'] ?? null);

        $refusal = $this->contactVerifier->attempt($phone, $code);

        if (null !== $refusal) {
            throw $refusal;
        }

        $this->primaryPhoneSetter->verified($phone);

        return new JsonResponse(self::serialised($phone));
    }

    /** Read on every open and every poll, so it must never spend a try or send a code itself. */
    #[Route('/api/auth/verify/phone/resend', name: 'auth_verify_phone_resend_cooldown', methods: ['GET'])]
    public function cooldown(Request $request): JsonResponse
    {
        $phone = $this->phone($request->query->getString('phone') ?: null);
        // Polled while the code is on WhatsApp, so a silent WhatsApp hands over to SMS in about 30 seconds.
        $this->phoneCodeDispatch->fallBackIfDue($phone);

        return new JsonResponse([
            'cooldownSeconds' => $this->resendCooldown->secondsLeftFor($phone),
            'codeState' => $this->contactVerifier->codeState($phone)->value,
            'route' => $this->phoneCodeDispatch->routeOf($phone)?->value,
        ]);
    }

    /** "Text it to me instead": the same code by SMS once, and later codes for this number by text too. */
    #[Route('/api/auth/verify/phone/text-instead', name: 'auth_verify_phone_text_instead', methods: ['POST'])]
    public function textInstead(Request $request): JsonResponse
    {
        $this->phoneCodeDispatch->textInstead($this->phone(self::named($request)));

        return new JsonResponse(['route' => PhoneCodeRoute::SmsChosen->value]);
    }

    #[Route('/api/auth/verify/phone/resend', name: 'auth_verify_phone_resend', methods: ['POST'])]
    public function resend(Request $request): JsonResponse
    {
        $phone = $this->phone(self::named($request));
        $issued = $this->verificationCodeResender->resend($phone);

        if (0 === $issued) {
            return new JsonResponse(['cooldownSeconds' => 0]);
        }

        if (\is_int($issued)) {
            throw new ApiException(
                ErrorCode::TooManyAttempts,
                'code.wait',
                [],
                null,
                ['Retry-After' => (string) $issued],
            );
        }

        $this->verificationCodeSender->send($phone, $issued);

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

    /** The number awaiting its code, or an alternative this account holds by its id (sc-113). */
    private function phone(?string $id): PhoneNumber
    {
        $user = $this->user();
        $phone = null === $id
            ? $user->getPhoneNumberAwaitingCode()
            : Iter\search($user->getPhoneNumbers(), static fn (PhoneNumber $held): bool => $held->getId()->toRfc4122() === $id);

        return $phone ?? throw ApiException::notFound('contacts.number_not_linked');
    }

    private static function named(Request $request): ?string
    {
        return '' === $request->getContent() ? null : Input::body($request, Type\shape(['phone' => Type\optional(Type\string())]))['phone'] ?? null;
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        }

        return $user;
    }
}
