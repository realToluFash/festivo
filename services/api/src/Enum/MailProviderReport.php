<?php

declare(strict_types=1);

namespace App\Enum;

/** What the mail provider's webhook last said of a sent email. A later, milder report never replaces a worse one. */
enum MailProviderReport: string
{
    case Delivered = 'delivered';
    case Bounced = 'bounced';
    case Complained = 'complained';

    public function outranks(?self $earlier): bool
    {
        return null === $earlier || $this->rank() > $earlier->rank();
    }

    /** Hard bounces and complaints: the address takes no more non-security mail. */
    public function suppresses(): bool
    {
        return self::Delivered !== $this;
    }

    private function rank(): int
    {
        return match ($this) {
            self::Delivered => 0,
            self::Bounced => 1,
            self::Complained => 2,
        };
    }
}
