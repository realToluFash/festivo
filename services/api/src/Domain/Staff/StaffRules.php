<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Staff\Model\StaffDetails;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Entity\StaffMember;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** What a roster entry may be (sc-3906), every problem at once; the web form checks the same before sending. */
final readonly class StaffRules
{
    public function __construct(
        private TranslatorInterface $translator,
        private PhoneNumberParser $phoneNumberParser,
    ) {
    }

    /** @param ?array{countryCode: string, number: string} $mobile */
    public function details(string $fullName, ?array $mobile, ?string $email): StaffDetails
    {
        $violations = [];
        $name = Str\trim($fullName);

        if ('' === $name) {
            $violations[] = $this->violation('fullName', 'validation.staff_name_required');
        } elseif (Str\length($name) > StaffMember::NAME_MAXIMUM) {
            $violations[] = $this->violation('fullName', 'validation.staff_name_too_long');
        }

        $e164 = null;

        if (null !== $mobile && '' !== Str\trim($mobile['number'])) {
            try {
                $e164 = $this->phoneNumberParser->parse($mobile['number'], $mobile['countryCode'], 'mobile')->number;
            } catch (ApiException $refused) {
                $violations = [...$violations, ...$refused->violations];
            }
        }

        $email = null === $email ? '' : Str\trim($email);

        if ('' !== $email && !\filter_var($email, \FILTER_VALIDATE_EMAIL)) {
            $violations[] = $this->violation('email', 'validation.email_invalid');
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new StaffDetails($name, $e164, '' === $email ? null : $email);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    private function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, ['{max}' => (string) StaffMember::NAME_MAXIMUM]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
