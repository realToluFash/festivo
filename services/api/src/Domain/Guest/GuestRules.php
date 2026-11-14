<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Domain\Guest\Model\NewGuest;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\SupportedLocales;
use Psl\Iter;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a guest added to a list may be (sc-1468). The web form checks the same before sending; this is the one that holds, every problem at once. */
final readonly class GuestRules
{
    public function __construct(
        private TranslatorInterface $translator,
        private PhoneNumberParser $phoneNumberParser,
    ) {
    }

    /**
     * @param ?array{countryCode: string, number: string} $mobile
     * @param list<?string>                               $companions each companion's name as typed, blank for none
     * @param ?string                                     $language   the host's Language, null for Not set
     */
    public function guest(string $fullName, ?string $email, ?array $mobile, array $companions, ?string $language = null): NewGuest
    {
        $violations = [];
        $name = Str\trim($fullName);

        if ('' === $name) {
            $violations[] = $this->violation('fullName', 'validation.guest_name_required');
        } elseif (Str\length($name) > Guest::NAME_MAXIMUM) {
            $violations[] = $this->violation('fullName', 'validation.guest_name_too_long');
        }

        $email = null === $email ? '' : Str\trim($email);

        if ('' !== $email && !\filter_var($email, \FILTER_VALIDATE_EMAIL)) {
            $violations[] = $this->violation('email', 'validation.email_invalid');
        }

        $e164 = null;

        if (null !== $mobile && '' !== Str\trim($mobile['number'])) {
            try {
                $e164 = $this->phoneNumberParser->parse($mobile['number'], $mobile['countryCode'], 'mobile')->number;
            } catch (ApiException $refused) {
                $violations = [...$violations, ...$refused->violations];
            }
        }

        if (Iter\count($companions) > Guest::COMPANIONS_MAXIMUM) {
            $violations[] = $this->violation('companions', 'validation.guest_companions_too_many');
        }

        $named = [];

        foreach ($companions as $index => $typed) {
            $companion = null === $typed ? '' : Str\trim($typed);

            if (Str\length($companion) > Guest::NAME_MAXIMUM) {
                $violations[] = $this->violation("companions[{$index}].fullName", 'validation.guest_name_too_long');
            }

            $named[] = '' === $companion ? null : $companion;
        }

        if (null !== $language && !Iter\contains(SupportedLocales::ALL, $language)) {
            $violations[] = $this->violation('language', 'validation.guest_language_unknown');
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new NewGuest($name, NameNormaliser::key($name), '' === $email ? null : $email, $e164, $named, $language);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, ['{count}' => (string) Guest::COMPANIONS_MAXIMUM, '{max}' => (string) Guest::NAME_MAXIMUM]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
