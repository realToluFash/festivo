<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Str;

/** The registry: a policy can only name a case, so a permission outside it cannot be asked for. */
enum Permission: string
{
    case EventsRead = 'events.read';
    case EventsManage = 'events.manage';
    case GuestsRead = 'guests.read';
    case GuestsManage = 'guests.manage';
    case SeatingRead = 'seating.read';
    case SeatingManage = 'seating.manage';
    case MenuRead = 'menu.read';
    case MenuManage = 'menu.manage';
    case RunOfShowRead = 'run_of_show.read';
    case RunOfShowManage = 'run_of_show.manage';
    case StaffRead = 'staff.read';
    case StaffManage = 'staff.manage';
    case MessagesRead = 'messages.read';
    case MessagesManage = 'messages.manage';
    case ReportsRead = 'reports.read';
    case ReportsManage = 'reports.manage';
    case BudgetRead = 'budget.read';
    case BudgetManage = 'budget.manage';
    case BudgetMargin = 'budget.margin';
    case VendorsRead = 'vendors.read';
    case VendorsManage = 'vendors.manage';
    case MembersRead = 'members.read';
    case MembersManage = 'members.manage';
    case BillingRead = 'billing.read';
    case BillingManage = 'billing.manage';
    case OrganisationManage = 'organisation.manage';

    public function area(): PermissionArea
    {
        return PermissionArea::from(Str\split($this->value, '.')[0]);
    }

    /** @return list<SeededRole> where a new organisation starts it; Owner holds every one regardless */
    public function defaultRoles(): array
    {
        $everyone = [SeededRole::Owner, SeededRole::Administrator, SeededRole::EventManager, SeededRole::Coordinator, SeededRole::ReadOnly];
        $managers = [SeededRole::Owner, SeededRole::Administrator, SeededRole::EventManager];
        $running = [...$managers, SeededRole::Coordinator];
        $admins = [SeededRole::Owner, SeededRole::Administrator];

        return match ($this) {
            self::EventsRead, self::GuestsRead, self::SeatingRead, self::MenuRead, self::RunOfShowRead, self::StaffRead,
            self::MessagesRead, self::ReportsRead, self::BudgetRead => $everyone,
            self::EventsManage, self::GuestsManage, self::SeatingManage, self::MenuManage, self::RunOfShowManage,
            self::MessagesManage => $running,
            self::StaffManage, self::ReportsManage, self::BudgetManage => $managers,
            self::BudgetMargin, self::VendorsRead, self::VendorsManage, self::MembersRead, self::MembersManage,
            self::BillingRead, self::OrganisationManage => $admins,
            self::BillingManage => [SeededRole::Owner],
        };
    }
}
