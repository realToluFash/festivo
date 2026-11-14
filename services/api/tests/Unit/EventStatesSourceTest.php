<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Event\Model\EventTransition;
use App\Enum\EventAction;
use App\Enum\EventGuard;
use App\Enum\EventPhase;
use App\Enum\EventStatus;
use BackedEnum;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** The clients read /event-states.json and the API its enums: one table, so drift either way fails here (sc-3584). */
final class EventStatesSourceTest extends TestCase
{
    #[Test]
    public function theStoredStatesAreTheDeclaredOnes(): void
    {
        self::assertSame($this->source()['states'], self::values(EventStatus::cases()), 'EventStatus has drifted from /event-states.json');
    }

    #[Test]
    public function theActionsAreTheDeclaredOnes(): void
    {
        self::assertSame($this->source()['actions'], self::values(EventAction::cases()), 'EventAction has drifted from /event-states.json');
    }

    #[Test]
    public function theGuardsAreTheDeclaredOnes(): void
    {
        self::assertSame($this->source()['guards'], self::values(EventGuard::cases()), 'EventGuard has drifted from /event-states.json');
    }

    #[Test]
    public function thePhasesAreTheDeclaredOnes(): void
    {
        self::assertSame(Vec\keys($this->source()['phases']), self::values(EventPhase::cases()), 'EventPhase has drifted from /event-states.json');
    }

    #[Test]
    public function eachPhaseAllowsWhatTheDeclarationSaysAndNothingElse(): void
    {
        $declared = $this->source()['phases'];

        foreach (EventPhase::cases() as $phase) {
            self::assertSame($declared[$phase->value], self::values($phase->allowed()), "What {$phase->value} allows disagrees with /event-states.json");
        }
    }

    #[Test]
    public function theTransitionsAreTheDeclaredOnes(): void
    {
        self::assertSame(
            $this->source()['transitions'],
            Vec\map(EventTransition::all(), static fn (EventTransition $row): array => [
                'from' => $row->from->value,
                'action' => $row->action->value,
                'to' => $row->to->value,
                'guards' => self::values($row->guards),
            ]),
            'EventTransition::all() has drifted from /event-states.json',
        );
    }

    #[Test]
    public function aMissingRowIsNoTransition(): void
    {
        self::assertNull(EventTransition::of(EventStatus::Live, EventAction::MakeLive));
        self::assertSame(EventStatus::Live, EventTransition::of(EventStatus::Draft, EventAction::MakeLive)?->to);
    }

    /**
     * @param list<BackedEnum> $cases
     *
     * @return list<int|string>
     */
    private static function values(array $cases): array
    {
        return Vec\map($cases, static fn (BackedEnum $case): int|string => $case->value);
    }

    /** @return array{states: list<string>, actions: list<string>, guards: list<string>, transitions: list<array{from: string, action: string, to: string, guards: list<string>}>, phases: array<string, list<string>>, '$comment': string} */
    private function source(): array
    {
        // A fixed mount, like LOCALES_FILE: the file lives outside the application's tree.
        $path = $_SERVER['EVENT_STATES_FILE'] ?? \getenv('EVENT_STATES_FILE') ?: null;

        self::assertIsString($path, 'EVENT_STATES_FILE is not set — see compose.yaml');
        self::assertFileExists($path, 'The event state declaration is missing');

        return Type\shape([
            '$comment' => Type\string(),
            'states' => Type\vec(Type\string()),
            'actions' => Type\vec(Type\string()),
            'guards' => Type\vec(Type\string()),
            'transitions' => Type\vec(Type\shape([
                'from' => Type\string(),
                'action' => Type\string(),
                'to' => Type\string(),
                'guards' => Type\vec(Type\string()),
            ])),
            'phases' => Type\dict(Type\string(), Type\vec(Type\string())),
        ])->coerce(Json\decode((string) \file_get_contents($path)));
    }
}
