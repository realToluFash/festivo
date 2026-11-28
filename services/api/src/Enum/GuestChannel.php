<?php

declare(strict_types=1);

namespace App\Enum;

/** A way an organisation reaches its guests, each stopped on its own (sc-3969). */
enum GuestChannel: string
{
    case Email = 'email';
    case Texts = 'sms';
    case WhatsApp = 'whatsapp';

    /** The key the guest's page and the guest's details carry it under. */
    public function field(): string
    {
        return match ($this) {
            self::Email => 'email',
            self::Texts => 'texts',
            self::WhatsApp => 'whatsApp',
        };
    }

    public static function fromField(string $field): ?self
    {
        foreach (self::cases() as $channel) {
            if ($channel->field() === $field) {
                return $channel;
            }
        }

        return null;
    }
}
