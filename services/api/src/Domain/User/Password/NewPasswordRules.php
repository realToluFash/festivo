<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\Interfaces\BreachedPasswordCheckerInterface;
use App\Enum\PasswordFailure;
use SensitiveParameter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** One set of rules for a password a person chooses, whether at registration or at a reset. */
final readonly class NewPasswordRules
{
    public function __construct(
        private BreachedPasswordCheckerInterface $breachedPasswordChecker,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> */
    public function violations(#[SensitiveParameter] string $password, string $path = 'password'): array
    {
        $failures = PasswordPolicy::check($password);

        // The corpus is asked only once the length rule passes. There is no
        // reason to spend a network call on a password that is already refused.
        if ([] === $failures && $this->breachedPasswordChecker->isBreached($password)) {
            $failures[] = PasswordFailure::Breached;
        }

        $violations = [];

        foreach ($failures as $failure) {
            $violations[] = [
                'propertyPath' => $path,
                'message' => $this->translator->trans('validation.' . $failure->value, [
                    '{count}' => match ($failure) {
                        PasswordFailure::TooShort => (string) PasswordPolicy::MINIMUM_LENGTH,
                        PasswordFailure::TooLong => (string) PasswordPolicy::MAXIMUM_LENGTH,
                        PasswordFailure::Breached, PasswordFailure::Unchanged => '',
                    },
                ]),
                'code' => $failure->value,
            ];
        }

        return $violations;
    }
}
