<?php

declare(strict_types=1);

namespace App\Enum;

/** Who carries a push target's messages: Web Push with VAPID for a browser, the Expo push service for the app. */
enum PushTargetKind: string
{
    case Web = 'web';
    case Expo = 'expo';
}
