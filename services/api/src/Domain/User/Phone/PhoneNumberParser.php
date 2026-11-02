<?php

declare(strict_types=1);

namespace App\Domain\User\Phone;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\ValidationResult;
use Locale;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Symfony\Contracts\Translation\LocaleAwareInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A number typed any way, for a chosen country, as E.164 or the reason it is not one. */
final readonly class PhoneNumberParser
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    public function parse(string $typed, string $countryCode, string $field = 'number'): ParsedPhone
    {
        $country = Str\uppercase(Str\trim($countryCode));

        if ('' === Str\trim($typed)) {
            throw $this->refusal($field, 'validation.phone_required', $country);
        }

        $util = PhoneNumberUtil::getInstance();

        if (!Iter\contains($util->getSupportedRegions(), $country)) {
            throw $this->refusal('countryCode', 'validation.country_invalid', $country);
        }

        try {
            $phone = $util->parse($typed, $country);
        } catch (NumberParseException $e) {
            throw $this->refusal($field, match ($e->getErrorType()) {
                NumberParseException::TOO_LONG => 'validation.phone_too_long',
                NumberParseException::TOO_SHORT_NSN, NumberParseException::TOO_SHORT_AFTER_IDD => 'validation.phone_too_short',
                default => 'validation.phone_invalid',
            }, $country);
        }

        $key = match ($util->isPossibleNumberWithReason($phone)) {
            ValidationResult::TOO_SHORT, ValidationResult::INVALID_LENGTH => 'validation.phone_too_short',
            ValidationResult::TOO_LONG => 'validation.phone_too_long',
            default => $util->isValidNumberForRegion($phone, $country) ? null : 'validation.phone_invalid',
        };

        if (null !== $key) {
            throw $this->refusal($field, $key, $country);
        }

        return new ParsedPhone(
            Type\non_empty_string()->assert($util->format($phone, PhoneNumberFormat::E164)),
            Type\non_empty_string()->assert($country),
        );
    }

    private function refusal(string $field, string $key, string $country): ApiException
    {
        $locale = $this->translator instanceof LocaleAwareInterface ? $this->translator->getLocale() : 'en';
        $name = Locale::getDisplayRegion('-' . $country, $locale);

        return ApiException::validation([[
            'propertyPath' => $field,
            'message' => $this->translator->trans($key, ['{country}' => '' === $name ? $country : $name]),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
