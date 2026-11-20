<?php

declare(strict_types=1);

namespace App\Enum;

/** Something a plan may switch on; which plan has which is the catalogue's to say, never a test of the plan by name (sc-581, sc-3928). */
enum PlanFeature: string
{
    case ServiceFloor = 'service_floor';
    case GuestList = 'guest_list';
    case Seating = 'seating';
    case Invitations = 'invitations';
    case Budget = 'budget';
    case Vendors = 'vendors';
    case SmsChannel = 'sms_channel';
    case WhatsAppChannel = 'whatsapp_channel';
    case Assistant = 'assistant';
    case EmailDomains = 'email_domains';
    case AuditLog = 'audit_log';
    case GuestDataDeletion = 'guest_data_deletion';
    case Margin = 'margin';
    case Branding = 'branding';
    case Api = 'api';
}
