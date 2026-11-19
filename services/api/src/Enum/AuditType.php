<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/** The audit log's six action types (sc-611): every action recorded about an organisation is in exactly one. A story that audits a new area adds its type here. */
enum AuditType: string
{
    case Events = 'events';
    case EventAccess = 'event_access';
    case Members = 'members';
    case Security = 'security';
    case Organisation = 'organisation';
    case AuditLog = 'audit_log';

    public const string VIEWED = 'audit_log.viewed';

    public const string EXPORTED = 'audit_log.exported';

    private const array ACTIONS = [
        'event.created' => self::Events,
        'event.updated' => self::Events,
        'event.cover_changed' => self::Events,
        'event.cover_removed' => self::Events,
        'event.thank_you_saved' => self::Events,
        'event.thank_you_removed' => self::Events,
        'event.made_live' => self::Events,
        'event.paused' => self::Events,
        'event.resumed' => self::Events,
        'event.ended' => self::Events,
        'event.deleted' => self::Events,
        'event.restored' => self::Events,
        'event.purged' => self::Events,
        'event_person.added' => self::EventAccess,
        'event_person.granted' => self::EventAccess,
        'event_person.claimed' => self::EventAccess,
        'event_person.changed' => self::EventAccess,
        'event_person.revoked' => self::EventAccess,
        'event_person.removed' => self::EventAccess,
        'event_person.dropped' => self::EventAccess,
        'event_person.expired' => self::EventAccess,
        'invitation.sent' => self::Members,
        'invitation.revoked' => self::Members,
        'request_link.turned_on' => self::Members,
        'request_link.turned_off' => self::Members,
        'request_link.replaced' => self::Members,
        'request_link.asked' => self::Members,
        'domain_join.asked' => self::Members,
        'domain_join.withdrawn' => self::Members,
        'membership.approved' => self::Members,
        'membership.turned_down' => self::Members,
        'membership.request_expired' => self::Members,
        'membership.suspended' => self::Members,
        'membership.suspension_expired' => self::Members,
        'membership.restored' => self::Members,
        'membership.role_changed' => self::Members,
        'membership.removed' => self::Members,
        'membership.left' => self::Members,
        'owner_claim.started' => self::Members,
        'owner_claim.found' => self::Members,
        'owner_claim.stopped' => self::Members,
        'owner_claim.withdrawn' => self::Members,
        'owner_claim.lapsed' => self::Members,
        'owner_claim.passed' => self::Members,
        'owner_claim.ended' => self::Members,
        'sign_in_rules.changed' => self::Security,
        'sign_in_rules.two_factor_held' => self::Security,
        'organisation_domain.added' => self::Security,
        'organisation_domain.removed' => self::Security,
        'email_domain.added' => self::Security,
        'email_domain.proved' => self::Security,
        'email_domain.failed' => self::Security,
        'email_domain.record_missing' => self::Security,
        'email_domain.lapsed' => self::Security,
        'email_domain.removed' => self::Security,
        'email_domain.only_ours_on' => self::Security,
        'email_domain.only_ours_notice_sent' => self::Security,
        'email_domain.only_ours_applied' => self::Security,
        'email_domain.only_ours_cancelled' => self::Security,
        'email_domain.only_ours_off' => self::Security,
        'organisation.created' => self::Organisation,
        'organisation.plan_changed' => self::Organisation,
        'organisation.ownership_transferred' => self::Organisation,
        'organisation.deleted' => self::Organisation,
        'organisation.restored' => self::Organisation,
        'organisation.purged' => self::Organisation,
        'organisation.export_asked' => self::Organisation,
        'organisation.export_downloaded' => self::Organisation,
        self::VIEWED => self::AuditLog,
        self::EXPORTED => self::AuditLog,
    ];

    public static function of(string $action): ?self
    {
        return self::ACTIONS[$action] ?? null;
    }

    /** @return list<string> */
    public static function actions(?self $type = null): array
    {
        return Type\vec(Type\string())->coerce(Vec\keys(null === $type ? self::ACTIONS : Dict\filter(self::ACTIONS, static fn (self $one): bool => $one === $type)));
    }

    /** Only these show a network address and a device, on screen and in the export. */
    public function showsWhereFrom(): bool
    {
        return self::Security === $this;
    }

    public static function isListed(string $action): bool
    {
        return Iter\contains_key(self::ACTIONS, $action);
    }
}
