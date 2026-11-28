<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use Symfony\Component\HttpFoundation\Request;

/** Whether the SMS provider signed a request it posted to Soirely. */
interface SmsRequestSignatureInterface
{
    public function signs(Request $request): bool;
}
