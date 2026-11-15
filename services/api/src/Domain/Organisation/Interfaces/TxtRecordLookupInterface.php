<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Interfaces;

/** Public DNS, asked for the TXT records at a name: how a domain is proved (sc-560, sc-6640). */
interface TxtRecordLookupInterface
{
    /** @return list<string> every TXT value published at the name, none when the lookup fails */
    public function lookUp(string $name): array;
}
