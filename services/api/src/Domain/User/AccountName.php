<?php

declare(strict_types=1);

namespace App\Domain\User;

use App\Audit\Auditor;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A person's own name, one rule wherever it is typed: sign-up, the details screen and Settings > Account (sc-22741). */
final readonly class AccountName
{
    public function __construct(
        private Auditor $auditor,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> */
    public function violations(string $trimmed): array
    {
        if ('' === $trimmed) {
            return [$this->nameViolation('validation.name_required')];
        }

        if (Str\length($trimmed) > User::NAME_MAXIMUM) {
            return [$this->nameViolation('validation.name_too_long', ['{count}' => (string) User::NAME_MAXIMUM])];
        }

        return [];
    }

    /** Characters are not checked: a name is whatever the person is called. The same name again changes and records nothing. */
    public function change(User $user, string $typed): void
    {
        $name = Str\trim($typed);
        $violations = $this->violations($name);

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        if ($name === $user->getName()) {
            return;
        }

        $this->auditor->record('name.changed', 'Account', $user->getId(), Actor::User, $user->getId(), $user->getName(), ['name' => [$user->getName(), $name]]);
        $user->setName($name);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function nameViolation(string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => 'name',
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
