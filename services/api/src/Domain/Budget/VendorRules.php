<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\VendorFields;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Enum\ErrorCode;
use App\Enum\VendorCategory;
use App\Http\Exception\ApiException;
use App\Locale\VisibleText;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The form's rules of 17 Oct (sc-82), checked again here: Name and Category required, the rest optional and checked only when typed.
 *
 * @phpstan-type TypedVendor array{name: string, category: string, contactName?: ?string, emailAddress?: ?string, phoneCountryCode?: ?string, phoneNumber?: ?string, website?: ?string, address?: ?string, note?: ?string}
 */
final readonly class VendorRules
{
    /** The longest each field may be, in characters; the email address's is RFC 5321 §4.5.3.1's, the website's is held once its scheme is added. */
    public const array LIMITS = [
        'name' => 100,
        'contactName' => 100,
        'emailAddress' => 254,
        'website' => 2048,
        'address' => 300,
        'note' => 1000,
    ];

    private const array TOO_LONG = [
        'name' => 'validation.vendor_name_too_long',
        'contactName' => 'validation.vendor_contact_name_too_long',
        'emailAddress' => 'validation.vendor_email_too_long',
        'website' => 'validation.vendor_website_too_long',
        'address' => 'validation.vendor_address_too_long',
        'note' => 'validation.vendor_note_too_long',
    ];

    public function __construct(
        private TranslatorInterface $translator,
        private PhoneNumberParser $phoneNumberParser,
    ) {
    }

    /** @param TypedVendor $typed */
    public function check(array $typed): VendorFields
    {
        $violations = [];
        $trimmed = [];

        foreach (self::LIMITS as $field => $most) {
            $value = Str\trim($typed[$field] ?? '');
            $trimmed[$field] = $value;

            if ('website' !== $field && VisibleText::tooLong($value, $most)) {
                $violations[$field] = $this->violation($field, self::TOO_LONG[$field], ['{count}' => $most]);
            }
        }

        if ('' === $trimmed['name']) {
            $violations['name'] = $this->violation('name', 'validation.vendor_name_required');
        }

        $category = VendorCategory::tryFrom(Str\trim($typed['category']));

        if (null === $category) {
            $violations['category'] = $this->violation('category', 'validation.vendor_category_required');
        }

        if (!isset($violations['emailAddress']) && '' !== $trimmed['emailAddress'] && !\filter_var($trimmed['emailAddress'], \FILTER_VALIDATE_EMAIL)) {
            $violations['emailAddress'] = $this->violation('emailAddress', 'validation.email_invalid');
        }

        $website = $this->website($trimmed['website']);

        if (null === $website) {
            $violations['website'] = $this->violation('website', 'validation.vendor_website_scheme');
        } elseif (VisibleText::tooLong($website, self::LIMITS['website'])) {
            $violations['website'] = $this->violation('website', self::TOO_LONG['website'], ['{count}' => self::LIMITS['website']]);
        }

        $phone = null;
        $typedPhone = Str\trim($typed['phoneNumber'] ?? '');

        if ('' !== $typedPhone) {
            try {
                $phone = $this->phoneNumberParser->parse($typedPhone, $typed['phoneCountryCode'] ?? '', 'phoneNumber', 'phoneCountryCode', 'validation.vendor_phone_invalid');
            } catch (ApiException $refused) {
                foreach ($refused->violations as $violation) {
                    $violations[$violation['propertyPath']] = $violation;
                }
            }
        }

        if ([] !== $violations || null === $category) {
            throw ApiException::validation(Vec\values($violations));
        }

        return new VendorFields(
            $trimmed['name'],
            $category,
            self::orNull($trimmed['contactName']),
            self::orNull($trimmed['emailAddress']),
            $phone?->number,
            $phone?->countryCode,
            self::orNull((string) $website),
            self::orNull($trimmed['address']),
            self::orNull($trimmed['note']),
        );
    }

    private function website(string $typed): ?string
    {
        if ('' === $typed) {
            return '';
        }

        $scheme = Regex\first_match($typed, '/^([a-z][a-z0-9+.-]*):(\/\/|(?!\d))/i');

        if (null === $scheme) {
            return 'https://' . $typed;
        }

        return Iter\contains(['http', 'https'], Str\lowercase($scheme[1])) ? $typed : null;
    }

    private static function orNull(string $value): ?string
    {
        return '' === $value ? null : $value;
    }

    /**
     * @param array<string, int|string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
