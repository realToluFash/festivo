<?php

declare(strict_types=1);

namespace App\Domain\Messaging\EventChanges;

use App\Domain\Messaging\Model\EventChangeEntry;
use App\Domain\Messaging\Model\EventChangeSummary;
use App\Domain\Messaging\Model\EventDetails;
use Closure;
use Psl\Iter;
use Psl\Vec;

/** Each field from its first value to its last, credited to its last setter, and every action; never the reader's own. */
final readonly class EventChangeSummariser
{
    /**
     * @param list<EventChangeEntry>              $entries the event's changes since the item began, oldest first
     * @param ?string                             $reader  the member it is for, whose own changes it leaves out; null for anybody's
     * @param Closure(string, mixed, mixed): bool $differs whether a field's line would read differently on its two sides
     */
    public static function summarise(array $entries, ?string $reader, Closure $differs): ?EventChangeSummary
    {
        $actions = [];
        $first = [];
        $last = [];
        $setBy = [];

        foreach ($entries as $entry) {
            if ($entry->kind->isAction() && (null === $reader || $entry->actorId !== $reader)) {
                $actions[] = $entry;
            }

            foreach ($entry->fields as $field => $moved) {
                if (!Iter\contains_key($first, $field)) {
                    $first[$field] = $moved[0];
                }

                $last[$field] = $moved[1];
                $setBy[$field] = $entry;
            }
        }

        $fields = [];
        $credited = $actions;

        foreach (EventDetails::FIELDS as $field) {
            if (!Iter\contains_key($setBy, $field) || (null !== $reader && $setBy[$field]->actorId === $reader) || !$differs($field, $first[$field], $last[$field])) {
                continue;
            }

            $fields[$field] = [$first[$field], $last[$field]];
            $credited[] = $setBy[$field];
        }

        if ([] === $credited) {
            return null;
        }

        $byTime = Vec\sort($credited, static fn (EventChangeEntry $a, EventChangeEntry $b): int => $a->id <=> $b->id);
        $leading = Iter\last($actions) ?? Iter\last($byTime);
        $others = [];

        foreach ($byTime as $entry) {
            if ($entry->person() !== $leading?->person()) {
                unset($others[$entry->person()]);
                $others[$entry->person()] = $entry;
            }
        }

        return null === $leading ? null : new EventChangeSummary(
            $leading,
            $fields,
            Iter\last($others),
            Iter\count($others) > 1 ? Iter\count($others) - 1 : 0,
            Iter\any($credited, static fn (EventChangeEntry $entry): bool => $entry->eventDay),
        );
    }
}
