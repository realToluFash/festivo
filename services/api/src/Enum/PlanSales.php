<?php

declare(strict_types=1);

namespace App\Enum;

/** How a plan is sold: a contract means no checkout sells it, though its list price is still published (sc-3935). */
enum PlanSales: string
{
    case SelfServe = 'self_serve';
    case Contract = 'contract';
}
