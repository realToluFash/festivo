<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Enum\SeededRole;
use App\Locale\SupportedLocales;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class SeededRoleLabels
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    public function label(SeededRole $seeded, string $locale): string
    {
        return $this->translator->trans($seeded->getReadable(), [], 'messages', $locale);
    }

    /** Ignoring case, in every language: a custom role by one of these names reads twice to whoever reads that language. */
    public function includes(string $name): bool
    {
        $wanted = Str\lowercase($name);
        $labels = Vec\flat_map(
            SeededRole::cases(),
            fn (SeededRole $seeded): array => Vec\map(SupportedLocales::ALL, fn (string $locale): string => $this->label($seeded, $locale)),
        );

        return Iter\any($labels, static fn (string $label): bool => Str\lowercase($label) === $wanted);
    }
}
