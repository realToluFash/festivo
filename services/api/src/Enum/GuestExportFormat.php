<?php

declare(strict_types=1);

namespace App\Enum;

/** The two files a host can export the guest list as (sc-3784): the two every caterer opens. */
enum GuestExportFormat: string
{
    case Xlsx = 'xlsx';
    case Csv = 'csv';

    public function contentType(): string
    {
        return match ($this) {
            self::Xlsx => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            self::Csv => 'text/csv; charset=UTF-8',
        };
    }
}
