<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\EventEditor;
use App\Enum\EventAction;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class EventEditActionsTest extends TestCase
{
    /** @return iterable<string, array{list<string>, list<EventAction>}> */
    public static function changes(): iterable
    {
        yield 'a name alone' => [['name'], [EventAction::Edit]];
        yield 'a venue and a currency' => [['venueName', 'currency'], [EventAction::Edit]];
        yield 'a start alone' => [['startsAt'], [EventAction::EditSchedule]];
        yield 'an end and a zone' => [['endsAt', 'timeZone'], [EventAction::EditSchedule]];
        yield 'a name and a start' => [['name', 'startsAt'], [EventAction::EditSchedule, EventAction::Edit]];
        yield 'nothing' => [[], []];
    }

    /**
     * @param list<string>      $changed
     * @param list<EventAction> $needed
     */
    #[Test]
    #[DataProvider('changes')]
    public function aChangeNeedsTheActionsOfTheFieldsItTouches(array $changed, array $needed): void
    {
        self::assertSame($needed, EventEditor::actionsFor($changed));
    }
}
