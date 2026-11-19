<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

use Psl\Vec;

/** One table of an organisation's archive: its columns, then its rows. */
final readonly class ArchiveTable
{
    /**
     * @param list<string>                              $columns
     * @param list<array<string, string|int|bool|null>> $rows
     */
    public function __construct(
        public array $columns,
        public array $rows,
    ) {
    }

    /** @return list<list<string>> the headings, then each row as text: blank for nothing, true or false for a yes or no */
    public function lines(): array
    {
        return [
            $this->columns,
            ...Vec\map($this->rows, static fn (array $row): array => Vec\map(
                Vec\values($row),
                static fn (string|int|bool|null $value): string => match (true) {
                    null === $value => '',
                    true === $value => 'true',
                    false === $value => 'false',
                    default => (string) $value,
                },
            )),
        ];
    }
}
