<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Str;

/** Every Mercure topic the API publishes on, declared once; the clients read the copy generated from it into @soirely/api-client. */
enum RealtimeTopic: string
{
    case UserNotifications = 'users/{id}/notifications';
    case EventSeating = 'events/{id}/seating';
    case EventSeatingChoices = 'events/{id}/seating/choices';
    case EventGuests = 'events/{id}/guests';
    case EventHeadcount = 'events/{id}/headcount';
    case EventCheckIn = 'events/{id}/check-in';
    case EventStaff = 'events/{id}/staff';
    case EventSchedule = 'events/{id}/schedule';
    case EventMenu = 'events/{id}/menu';
    case EventScreens = 'events/{id}/screens';
    case EventGuestPages = 'events/{id}/guest-pages';
    case EventBudget = 'events/{id}/budget';

    public function for(string $id): string
    {
        return Str\replace($this->value, '{id}', $id);
    }
}
