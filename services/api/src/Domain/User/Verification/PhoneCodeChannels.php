<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use Psl\Iter;
use Psl\Str;
use Psl\Vec;

/** Each country's channel order, in configuration (sc-750): WhatsApp first by default, SMS only where listed. */
final readonly class PhoneCodeChannels
{
    /** @var list<string> */
    private array $smsOnly;

    public function __construct(
        private bool $whatsAppEnabled,
        string $smsOnlyCountries,
    ) {
        $this->smsOnly = Vec\filter(Vec\map(Str\split($smsOnlyCountries, ','), static fn (string $code): string => Str\uppercase(Str\trim($code))), static fn (string $code): bool => '' !== $code);
    }

    public function whatsAppFirst(?string $countryCode): bool
    {
        return $this->whatsAppEnabled && !Iter\contains($this->smsOnly, Str\uppercase($countryCode ?? ''));
    }
}
