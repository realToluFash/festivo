<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice\Model;

use DateTimeImmutable;
use DateTimeZone;
use Psl\Type;

/** What a person on the staff knows of their part in the event: their shifts as wall-clock times in the event's zone, their job, the event's first day and its venue's name. */
final readonly class ShiftTold
{
    /**
     * @param array<string, array{0: string, 1: string}> $shifts by shift id, `Y-m-d H:i` start and end
     * @param ?array{0: string, 1: string}               $job    its id, so a rename changes nothing, and its name as told
     */
    public function __construct(
        public array $shifts,
        public ?array $job,
        public string $date,
        public ?string $venue,
    ) {
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return ['shifts' => $this->shifts, 'job' => $this->job, 'date' => $this->date, 'venue' => $this->venue];
    }

    /** @param array<array-key, mixed> $stored */
    public static function fromArray(array $stored): self
    {
        $shape = Type\shape([
            'shifts' => Type\dict(Type\string(), Type\shape([Type\string(), Type\string()])),
            'job' => Type\nullable(Type\shape([Type\string(), Type\string()])),
            'date' => Type\string(),
            'venue' => Type\nullable(Type\string()),
        ])->coerce($stored);

        return new self($shape['shifts'], $shape['job'], $shape['date'], $shape['venue']);
    }

    public static function wall(string $stored): DateTimeImmutable
    {
        return new DateTimeImmutable($stored, new DateTimeZone('UTC'));
    }
}
