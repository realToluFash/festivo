<?php

declare(strict_types=1);

namespace App\Enum;

/** Where an organisation's export stands (sc-612): a failed one does not count toward the daily limit. */
enum OrganisationExportStatus: string
{
    case Preparing = 'preparing';
    case Ready = 'ready';
    case Failed = 'failed';
}
