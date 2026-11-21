<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies\Model;

use App\Enum\GuestChangeKind;
use App\Enum\GuestReply;
use Psl\Iter;
use Psl\Vec;

/** The guests a member has not looked at yet, counted as the bell, the push and the summary count them. */
final readonly class GuestReplyTally
{
    /** The bell's order, which is also the summary's for the replies. */
    public const array ORDER = ['coming', 'notComing', 'maybe', 'changed', 'needs', 'flagged', 'question'];

    /** @param list<GuestChangeRow> $rows newest first */
    public function __construct(
        public array $rows,
    ) {
    }

    public function isEmpty(): bool
    {
        return [] === $this->rows;
    }

    public function guests(): int
    {
        return Iter\count($this->rows);
    }

    /** Whether every guest it counts replied, which a push words as replies rather than updates. */
    public function onlyReplies(): bool
    {
        return Iter\all($this->rows, static fn (GuestChangeRow $row): bool => $row->kind->isReply());
    }

    public function replies(): int
    {
        return Iter\count(Vec\filter($this->rows, static fn (GuestChangeRow $row): bool => $row->kind->isReply()));
    }

    /** @return array<string, list<string>> the names under each count, in ORDER, only the counts above 0 */
    public function byCount(): array
    {
        $names = [];

        foreach (self::ORDER as $count) {
            $under = Vec\map(Vec\filter($this->rows, static fn (GuestChangeRow $row): bool => self::countOf($row) === $count), static fn (GuestChangeRow $row): string => $row->name);

            if ([] !== $under) {
                $names[$count] = $under;
            }
        }

        return $names;
    }

    private static function countOf(GuestChangeRow $row): string
    {
        return match ($row->kind) {
            GuestChangeKind::Replied => match ($row->answer) {
                GuestReply::Coming => 'coming',
                GuestReply::NotComing => 'notComing',
                GuestReply::Maybe => 'maybe',
                GuestReply::NoReply, null => 'changed',
            },
            GuestChangeKind::Changed => 'changed',
            GuestChangeKind::Needs => 'needs',
            GuestChangeKind::Flagged => 'flagged',
            GuestChangeKind::Question => 'question',
        };
    }
}
