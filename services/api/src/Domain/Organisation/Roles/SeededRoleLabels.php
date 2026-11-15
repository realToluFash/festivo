<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Enum\SeededRole;
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
}
