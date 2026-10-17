<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The five fields, checked the same way when an organisation is founded and when it is edited. */
final readonly class OrganisationRules
{
    public const int NAME_MAXIMUM = 100;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * @param array{name: string, countryCode: string, currency: string, timezone: string, contactAddress: string} $fields
     *
     * @return array{name: string, countryCode: string, currency: string, timezone: string, contactAddress: string}
     */
    public function check(array $fields): array
    {
        $checked = [
            'name' => Str\trim($fields['name']),
            'countryCode' => Str\uppercase(Str\trim($fields['countryCode'])),
            'currency' => Str\uppercase(Str\trim($fields['currency'])),
            'timezone' => Str\trim($fields['timezone']),
            'contactAddress' => EmailAddressNormaliser::normalise($fields['contactAddress']),
        ];

        $violations = [];

        if ('' === $checked['name']) {
            $violations[] = $this->violation('name', 'validation.organisation_name_required');
        } elseif (Str\length($checked['name']) > self::NAME_MAXIMUM) {
            $violations[] = $this->violation('name', 'validation.organisation_name_too_long', [
                '{count}' => (string) self::NAME_MAXIMUM,
            ]);
        }

        if (!Regions::isCountry($checked['countryCode'])) {
            $violations[] = $this->violation('countryCode', 'validation.country_invalid');
        }

        if (!Regions::isCurrency($checked['currency'])) {
            $violations[] = $this->violation('currency', 'validation.currency_invalid');
        }

        $zone = AccountTimeZone::canonical($checked['timezone']);

        if (null === $zone) {
            $violations[] = $this->violation('timezone', 'validation.timezone_invalid');
        } else {
            $checked['timezone'] = $zone;
        }

        if ('' === $checked['contactAddress']) {
            $violations[] = $this->violation('contactAddress', 'validation.contact_address_required');
        } elseif (!\filter_var($checked['contactAddress'], \FILTER_VALIDATE_EMAIL)) {
            $violations[] = $this->violation('contactAddress', 'validation.contact_address_invalid');
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return $checked;
    }

    /**
     * @param array<string, string> $parameters
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
