<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Iter;
use Psl\Str;

/** The registry: a policy can only name a case, so a permission outside it cannot be asked for. */
enum Permission: string
{
    case EventsRead = 'events.read';
    case EventsManage = 'events.manage';
    case EventsCreate = 'events.create';
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
    case PeopleRead = 'people.read';
    case PeopleManage = 'people.manage';

    public function area(): PermissionArea
    {
        return PermissionArea::from(Str\split($this->value, '.')[0]);
    }

    /** What an organisation's two-factor rule for administrators covers (sc-69): members, roles, billing and the organisation itself. */
    public function isAdministrative(): bool
    {
        return Iter\contains([PermissionArea::Members, PermissionArea::Billing, PermissionArea::Organisation], $this->area());
    }

    /** A `.manage` permission or Create events: what the read-only rule for an unlinked member keeps back (sc-69). */
    public function isChange(): bool
    {
        return self::EventsCreate === $this || Str\ends_with($this->value, '.manage');
    }

    /** @return list<SeededRole> the organisation roles holding it everywhere: a Member holds nothing but what their roles on events give (sc-29912) */
    public function defaultRoles(): array
    {
        return self::BillingManage === $this ? [SeededRole::Owner] : [SeededRole::Owner, SeededRole::Admin];
    }
}
