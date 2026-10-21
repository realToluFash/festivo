<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\EventAction;
use App\Enum\EventState;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Vec;

/** The clients read /event-states.json and the API applies EventState::allows(): one table, so any drift fails here. */ final class EventStatesSourceTest extends TestCase
{
    #[Test]
    public function thePhpStatesAreTheDeclaredStates(): void
    {
        self::assertSame(
            Vec\keys($this->source()['states']),
            Vec\map(EventState::cases(), static fn (EventState $state): string => $state->value),
            'EventState has drifted from /event-states.json',
        );
    }

    #[Test]
    public function thePhpActionsAreTheDeclaredActions(): void
    {
        self::assertSame(
            $this->source()['actions'],
            Vec\map(EventAction::cases(), static fn (EventAction $action): string => $action->value),
            'EventAction has drifted from /event-states.json',
        );
    }

    #[Test]
    public function everyStateAllowsWhatTheDeclarationSaysAndNothingElse(): void
    {
        $states = $this->source()['states'];

        foreach (EventState::cases() as $state) {
            foreach (EventAction::cases() as $action) {
                self::assertSame(
                    Iter\contains($states[$state->value], $action->value),
                    $state->allows($action),
                    "{$state->value} × {$action->value} disagrees with /event-states.json",
                );
            }
        }
    }

    /** @return array{actions: list<string>, states: array<string, list<string>>} */
    private function source(): array
    {
        // A fixed mount, like LOCALES_FILE: the file lives outside the application's tree.
        $path = $_SERVER['EVENT_STATES_FILE'] ?? \getenv('EVENT_STATES_FILE') ?: null;

        self::assertIsString($path, 'EVENT_STATES_FILE is not set — see compose.yaml');
        self::assertFileExists($path, 'The event state declaration is missing');

        return \json_decode((string) \file_get_contents($path), true, 512, \JSON_THROW_ON_ERROR);
    }
}
