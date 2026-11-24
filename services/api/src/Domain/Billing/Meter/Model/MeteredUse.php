<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Model;

use App\Enum\UsageKind;
use App\Enum\WhatsAppCategory;
use InvalidArgumentException;

/** What a caller reserves or settles: a kind, how many, and what sets its price. */
final readonly class MeteredUse
{
    /** @var int<1, max> segments for an SMS, otherwise 1 per message or request */
    public int $quantity;

    /**
     * @param ?string $country              ISO 3166-1 alpha-2 of the recipient, which prices an SMS or a WhatsApp message
     * @param ?int    $providerMicroDollars what the provider charges, for a country the unit costs leave to the formula (sc-3928)
     */
    public function __construct(
        public UsageKind $kind,
        int $quantity = 1,
        public ?string $country = null,
        public ?WhatsAppCategory $whatsAppCategory = null,
        public ?int $providerMicroDollars = null,
    ) {
        if (UsageKind::StorageBytes === $kind) {
            throw new InvalidArgumentException('Storage is a gauge: it is measured, never reserved or settled.');
        }

        if ($quantity < 1) {
            throw new InvalidArgumentException('A metered use counts at least one unit.');
        }

        $this->quantity = $quantity;

        if ((UsageKind::Sms === $kind || UsageKind::WhatsApp === $kind) && null === $country) {
            throw new InvalidArgumentException('An SMS or a WhatsApp message is priced by its country.');
        }

        if (UsageKind::WhatsApp === $kind && null === $whatsAppCategory) {
            throw new InvalidArgumentException('A WhatsApp message is priced by the category Meta billed.');
        }
    }
}
