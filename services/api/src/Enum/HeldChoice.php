<?php

declare(strict_types=1);

namespace App\Enum;

/** A held guest's answer (sc-4005); a guest who hasn't chosen waits for all. */
enum HeldChoice: string
{
    case WhatsReadyNow = 'whatsReadyNow';
    case WaitForAll = 'waitForAll';
}
