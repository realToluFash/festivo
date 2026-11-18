<?php

declare(strict_types=1);

namespace App\Enum;

/** A setting some plan unlocks, by the page it is set on; `Plan::unlocks()` says which. Each joins the list when its story builds it (sc-560, sc-563). */
enum PlanFeature: string
{
    case EmailDomains = 'email_domains';
    case AuditLog = 'audit_log';
    case GuestDataDeletion = 'guest_data_deletion';
}
