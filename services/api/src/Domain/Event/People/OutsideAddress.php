<?php

declare(strict_types=1);

namespace App\Domain\Event\People;

use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Enum\ContactKind;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberUtil;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** sc-71's form checks: an @ makes it an email address, anything else a mobile number, read by its own code after a + and for the organisation's country otherwise. */
final readonly class OutsideAddress
{
    public const string FIELD = 'address';

    public function __construct(
        private PhoneNumberParser $phoneNumberParser,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return array{0: non-empty-string, 1: ContactKind} an email address in lower case, a number in E.164 */
    public function read(string $typed, string $organisationCountry): array
    {
        $trimmed = Str\trim($typed);

        if ('' === $trimmed) {
            throw $this->addressRefused('people.address_required');
        }

        if (Str\contains($trimmed, '@')) {
            $email = EmailAddressNormaliser::normalise($trimmed);

            if ('' === $email || false === \filter_var($email, \FILTER_VALIDATE_EMAIL)) {
                throw $this->addressRefused('people.address_unusable');
            }

            return [$email, ContactKind::Email];
        }

        try {
            return [$this->phoneNumberParser->parse($trimmed, $this->countryOf($trimmed, $organisationCountry), self::FIELD)->number, ContactKind::Mobile];
        } catch (ApiException) {
            throw $this->addressRefused('people.address_unusable');
        }
    }

    private function countryOf(string $typed, string $organisationCountry): string
    {
        if (!Str\starts_with($typed, '+')) {
            return $organisationCountry;
        }

        $util = PhoneNumberUtil::getInstance();

        try {
            return $util->getRegionCodeForNumber($util->parse($typed, null)) ?? $organisationCountry;
        } catch (NumberParseException) {
            return $organisationCountry;
        }
    }

    private function addressRefused(string $key): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => self::FIELD,
            'message' => $this->translator->trans($key),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
