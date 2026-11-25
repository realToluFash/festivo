<?php

declare(strict_types=1);

namespace App\Enum;

/** Who gets it's conditions (sc-3957); meals and seats add theirs here. The wire names are the clients'. */
enum GuestConditionType: string
{
    case Replied = 'replied';
    case NotReplied = 'notReplied';
    case Coming = 'coming';
    case NotComing = 'notComing';
    case NotSure = 'notSure';
    case Invited = 'invited';
    case NotInvited = 'notInvited';
    case HasEmail = 'hasEmail';
    case HasMobile = 'hasMobile';
    case InGroup = 'inGroup';

    /** On `guests g`; `:group` only for InGroup with a group, No group being null. */
    public function sql(bool $withGroup): string
    {
        $noReply = "(g.reply IS NULL OR g.reply = 'noReply')";

        return match ($this) {
            self::Replied => "g.reply IN ('coming', 'maybe', 'notComing')",
            self::NotReplied => 'g.invited_at IS NOT NULL AND ' . $noReply,
            self::Coming => "g.reply = 'coming'",
            self::NotComing => "g.reply = 'notComing'",
            self::NotSure => "g.reply = 'maybe'",
            self::Invited => 'g.invited_at IS NOT NULL',
            self::NotInvited => 'g.invited_at IS NULL AND ' . $noReply,
            self::HasEmail => "COALESCE(g.email, '') <> ''",
            self::HasMobile => "COALESCE(g.mobile, '') <> ''",
            self::InGroup => $withGroup ? 'g.group_id = CAST(:group AS UUID)' : 'g.group_id IS NULL',
        };
    }
}
