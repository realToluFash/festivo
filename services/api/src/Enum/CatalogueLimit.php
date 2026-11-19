<?php

declare(strict_types=1);

namespace App\Enum;

/** A line of a plan's terms in the catalogue; the catalogue says each one's kind and amount (sc-3928). */
enum CatalogueLimit: string
{
    case LiveEvents = 'live_events';
    case GuestsPerEvent = 'guests_per_event';
    case TeamSeats = 'team_seats';
    case Email = 'email';
    case Sms = 'sms';
    case WhatsApp = 'whatsapp';
    case AiRequests = 'ai_requests';
    case StorageBytes = 'storage_bytes';
    case Credits = 'credits';

    /** Which code enforces it, so a version cannot change it: that takes a story building the new enforcement. */
    public function kind(): LimitKind
    {
        return match ($this) {
            self::LiveEvents, self::GuestsPerEvent, self::TeamSeats => LimitKind::Hard,
            self::Email => LimitKind::Included,
            self::Sms, self::WhatsApp, self::AiRequests, self::StorageBytes => LimitKind::Metered,
            self::Credits => LimitKind::Credits,
        };
    }
}
