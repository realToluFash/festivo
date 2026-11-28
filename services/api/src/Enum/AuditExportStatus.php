<?php

declare(strict_types=1);

namespace App\Enum;

/** Where an audit log export too large to download at once stands (sc-611). */
enum AuditExportStatus: string
{
    case Preparing = 'preparing';
    case Ready = 'ready';
    case Failed = 'failed';
}
