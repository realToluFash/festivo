<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;

/** How a guest came to be Invited (sc-3788): the first five are chosen by hand on Mark as invited. */
enum GuestInvitationMethod: string
{
    case WhatsApp = 'whatsapp';
    case TextMessage = 'textMessage';
    case Email = 'email';
    case InPerson = 'inPerson';
    case Other = 'other';
    case SoirelyMessage = 'soirelyMessage';
    case Reply = 'reply';

    /** @return list<self> */
    public static function byHand(): array
    {
        return [self::WhatsApp, self::TextMessage, self::Email, self::InPerson, self::Other];
    }

    public function isByHand(): bool
    {
        return Iter\contains(self::byHand(), $this);
    }
}
