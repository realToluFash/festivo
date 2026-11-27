<?php

declare(strict_types=1);

namespace App\Enum;

/** How far a person's own link has got (sc-3912), in the only order it moves; Copied and Shared (the app's share sheet, sc-77903) are one step, and Replace link alone returns it to None. */
enum StaffLinkStatus: string
{
    case None = 'none';
    case Copied = 'copied';
    case Shared = 'shared';
    case Sent = 'sent';
    case Opened = 'opened';

    public function delivered(): bool
    {
        return self::Sent === $this || self::Opened === $this;
    }

    public function handedOut(): bool
    {
        return self::Copied === $this || self::Shared === $this;
    }
}
