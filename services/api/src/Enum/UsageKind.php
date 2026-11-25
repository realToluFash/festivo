<?php

declare(strict_types=1);

namespace App\Enum;

/** What the meter records (sc-3929): three message kinds, AI requests and stored bytes. */
enum UsageKind: string
{
    case Email = 'email';
    case Sms = 'sms';
    case WhatsApp = 'whatsapp';
    case AiRequest = 'ai_request';
    case StorageBytes = 'storage_bytes';

    /** The message kinds share their idempotency keys, so one message is charged once whichever channel reports it (sc-3929, 26 Oct). */
    public function keyScope(): string
    {
        return $this->isMessage() ? 'message' : $this->value;
    }

    public function isMessage(): bool
    {
        return match ($this) {
            self::Email, self::Sms, self::WhatsApp => true,
            self::AiRequest, self::StorageBytes => false,
        };
    }

    /** The plan line holding its included amount. */
    public function limit(): CatalogueLimit
    {
        return match ($this) {
            self::Email => CatalogueLimit::Email,
            self::Sms => CatalogueLimit::Sms,
            self::WhatsApp => CatalogueLimit::WhatsApp,
            self::AiRequest => CatalogueLimit::AiRequests,
            self::StorageBytes => CatalogueLimit::StorageBytes,
        };
    }
}
