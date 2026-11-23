<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Entity\Event;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Html;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * The kitchen sheet as one HTML document for the PDF (sc-3911): the page's order, headings and words, black on white, real headings and tables, the health footer on every page, no prices.
 *
 * @phpstan-import-type Sheet from KitchenSheet
 * @phpstan-import-type SheetCourse from KitchenSheet
 * @phpstan-import-type Allergic from KitchenSheet
 * @phpstan-import-type Cell from KitchenSheet
 */
final readonly class KitchenSheetDocument
{
    private const string STYLE = <<<'CSS'
        @page { size: %s; margin: 16mm 16mm 22mm; @bottom-left { content: element(foot); width: 75%%; vertical-align: top; } @bottom-right { content: %s; font-size: 8pt; vertical-align: top; } }
        html { font-family: 'Instrument Sans', sans-serif; font-size: 10pt; color: #000; background: #fff; }
        body { margin: 0; }
        h1 { font-size: 18pt; margin: 0 0 4pt; }
        h2 { font-size: 13pt; margin: 16pt 0 6pt; break-after: avoid; }
        .head p { margin: 0 0 2pt; }
        table { width: 100%%; border-collapse: collapse; margin: 0 0 6pt; }
        th, td { border: 1px solid #000; padding: 3pt 5pt; text-align: left; vertical-align: top; }
        thead th { font-weight: 700; }
        tbody th { font-weight: 400; }
        tr { break-inside: avoid; }
        .n { text-align: right; width: 18%%; }
        .under th { padding-left: 16pt; }
        .room th, .room td { font-weight: 700; }
        .allergies { border: 2px solid #000; padding: 0 8pt 6pt; }
        .line { margin: 0 0 6pt; }
        .mark { display: inline-block; width: 7pt; height: 7pt; margin-right: 4pt; border: 1px solid #000; border-radius: 50%%; }
        .mark.host { width: 0; height: 0; border-width: 0 4pt 7pt; border-color: transparent transparent #000; border-radius: 0; }
        .mark.never, .mark.notYet { border-style: dashed; }
        .mark.skipped { background: linear-gradient(#000, #000) center / 5pt 1px no-repeat; }
        .foot { position: running(foot); font-size: 8pt; }
        CSS;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param Sheet $sheet */
    public function html(Event $event, array $sheet, string $locale): string
    {
        $title = $this->word('title', $locale);
        $courses = $sheet['courses'];

        return Str\format(
            '<!doctype html><html lang="%s"><head><meta charset="utf-8"><title>%s</title><style>%s</style></head><body>%s%s%s%s</body></html>',
            self::e($locale),
            self::e($title . ' · ' . $event->getName()),
            Str\format(self::STYLE, $sheet['paper']->pageSize(), self::cssString($this->word('page', $locale, ['n' => "\u{1}", 'm' => "\u{2}"]))),
            Str\format(
                '<div class="foot">%s</div><header class="head"><h1>%s</h1><p>%s</p><p>%s</p><p>%s</p><p>%s</p></header>',
                self::e($this->word('health', $locale)),
                self::e($title),
                self::e($event->getName()),
                self::e($this->day($event->getStartsAt(), $event->getTimeZone(), $locale)),
                self::e($this->word('as_of', $locale, ['at' => $this->asOf($sheet['asOf'], $event->getTimeZone(), $locale)])),
                self::e(Str\join([
                    $this->word('coming', $locale, ['count' => $sheet['coming']]),
                    $this->word('allergic', $locale, ['count' => $sheet['allergicCount']]),
                    $this->word('courses', $locale, ['count' => Iter\count($courses)]),
                ], ' · ')),
            ),
            $this->allergies($sheet, $locale),
            $this->diets($sheet, $locale),
            Str\join(Vec\map($courses, fn (array $course): string => $this->course($course, $locale)), ''),
        );
    }

    /** @param Sheet $sheet */
    private function allergies(array $sheet, string $locale): string
    {
        $head = '<section class="allergies"><h2>' . self::e($this->word('allergies', $locale)) . '</h2>';

        if (0 === $sheet['allergicCount']) {
            return $head . $this->line($this->word('no_allergies', $locale)) . '</section>';
        }

        $perAllergen = Vec\map($sheet['allergyCounts'], fn (array $one): array => [$this->allergen($one['code'], null, $locale), $one['count']]);

        if (null === $sheet['allergic']) {
            return $head . $this->countsTable($this->word('allergen', $locale), $perAllergen, $locale) . $this->line($this->word('names_need', $locale)) . '</section>';
        }

        $columns = Vec\map($sheet['courses'], static fn (array $course): string => '<th scope="col">' . self::e($course['name']) . '</th>');
        $rows = Vec\map($sheet['allergic'], fn (array $person): string => $this->allergicRow($person, $locale));
        $line = Str\join(Vec\map($perAllergen, fn (array $one): string => $this->word('per_allergen', $locale, ['allergen' => $one[0], 'count' => $one[1]])), ' · ');

        return $head
            . '<table><thead><tr><th scope="col">' . self::e($this->word('name', $locale)) . '</th><th scope="col">' . self::e($this->word('allergic_to', $locale)) . '</th>' . Str\join($columns, '') . '</tr></thead>'
            . '<tbody>' . Str\join($rows, '') . '</tbody></table>'
            . $this->line($line)
            . '</section>';
    }

    /** @param Allergic $person */
    private function allergicRow(array $person, string $locale): string
    {
        $allergens = Str\join(Vec\map($person['allergens'], fn (string $code): string => $this->allergen($code, $person['otherAllergy'], $locale)), ', ');
        $cells = Vec\map($person['cells'], fn (array $cell): string => '<td>' . $this->cell($cell, $locale) . '</td>');

        return '<tr><th scope="row">' . self::e($person['name']) . '</th><td>' . self::e($allergens) . '</td>' . Str\join($cells, '') . '</tr>';
    }

    /** @param Cell $cell */
    private function cell(array $cell, string $locale): string
    {
        if ('dish' === $cell['kind']) {
            return self::e($cell['text'] ?? '');
        }

        return $this->marked($cell['kind'], $this->word('cell_' . Str\lowercase($cell['kind']), $locale));
    }

    /** @param Sheet $sheet */
    private function diets(array $sheet, string $locale): string
    {
        $head = '<section><h2>' . self::e($this->word('diets', $locale)) . '</h2>';

        if ([] === $sheet['dietCounts']) {
            return $head . $this->line($this->word('no_diets', $locale)) . '</section>';
        }

        $rows = Vec\map($sheet['dietCounts'], fn (array $one): array => [
            'other' === $one['code'] ? $this->word('other_diet', $locale) : $this->translator->trans('guest_export.diet.' . $one['code'], [], 'messages', $locale),
            $one['count'],
        ]);

        return $head . $this->countsTable($this->word('diet', $locale), $rows, $locale) . '</section>';
    }

    /** @param SheetCourse $course */
    private function course(array $course, string $locale): string
    {
        $rows = Vec\map($course['rows'], fn (array $row): string => match ($row['kind']) {
            'variant' => $this->countRow($this->word('variant', $locale, ['name' => $row['name']]), $row['count'], 'under'),
            'side' => $this->countRow($this->word('side', $locale, ['name' => $row['name']]), $row['count'], 'under'),
            default => $this->countRow($row['name'], $row['count']),
        });
        $states = [
            $this->countRow($this->word('kitchen', $locale), $course['kitchen']),
            $this->countRow($this->word('skipped', $locale), $course['skipped'], mark: 'skipped'),
            ...$course['needsHost'] > 0 ? [$this->countRow($this->word('needs_host', $locale), $course['needsHost'], mark: 'host')] : [],
            ...$course['notChosen'] > 0 ? [$this->countRow($this->word($course['never'] ? 'never' : 'not_yet', $locale, ['count' => $course['notChosen']]), $course['notChosen'], mark: $course['never'] ? 'never' : 'notYet')] : [],
        ];
        $given = $course['given'];

        return '<section><h2>' . self::e($course['name']) . '</h2>'
            . '<table><thead><tr><th scope="col">' . self::e($this->word('dish', $locale)) . '</th><th scope="col" class="n">' . self::e($this->word('people', $locale)) . '</th></tr></thead><tbody>'
            . Str\join([...$rows, ...$states], '')
            . $this->countRow($this->word('room', $locale), $course['room'], 'room')
            . '</tbody></table>'
            . (null === $given ? '' : $this->line($this->word('given', $locale, ['count' => $given['count'], 'dish' => $given['plate']])))
            . ($course['sides'] ? $this->line($this->word('sides', $locale)) : '')
            . '</section>';
    }

    /** @param list<array{string, int}> $rows */
    private function countsTable(string $what, array $rows, string $locale): string
    {
        return '<table><thead><tr><th scope="col">' . self::e($what) . '</th><th scope="col" class="n">' . self::e($this->word('people', $locale)) . '</th></tr></thead><tbody>'
            . Str\join(Vec\map($rows, fn (array $row): string => $this->countRow($row[0], $row[1])), '')
            . '</tbody></table>';
    }

    private function countRow(string $name, int $count, ?string $class = null, ?string $mark = null): string
    {
        return (null === $class ? '<tr>' : '<tr class="' . $class . '">')
            . '<th scope="row">' . (null === $mark ? self::e($name) : $this->marked($mark, $name)) . '</th><td class="n">' . $count . '</td></tr>';
    }

    /** A state's shape is drawn by its border, so it is decoration and only its word is read. */
    private function marked(string $kind, string $words): string
    {
        return '<span class="mark ' . self::e($kind) . '"></span>' . self::e($words);
    }

    private function line(string $words): string
    {
        return '<p class="line">' . self::e($words) . '</p>';
    }

    private function allergen(string $code, ?string $other, string $locale): string
    {
        return 'other' === $code && null !== $other
            ? $this->word('other_allergy', $locale, ['what' => $other])
            : $this->translator->trans('guest_export.allergen.' . $code, [], 'messages', $locale);
    }

    /** @param array<string, int|string> $parameters */
    private function word(string $key, string $locale, array $parameters = []): string
    {
        return $this->translator->trans('kitchen_sheet.' . $key, $parameters, 'messages', $locale);
    }

    private function day(DateTimeImmutable $at, string $zone, string $locale): string
    {
        $formatter = IntlDateFormatter::create(SupportedLocales::dates($locale), IntlDateFormatter::FULL, IntlDateFormatter::NONE, new DateTimeZone($zone));

        return $formatter?->format($at) ?: $at->setTimezone(new DateTimeZone($zone))->format('l j F Y');
    }

    /** "Tuesday, Jun 8 · 19:42": the snapshot's day and its time on the 24-hour clock, in the event's time zone. */
    private function asOf(string $at, string $zone, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $moment = new DateTimeImmutable($at);
        $timeZone = new DateTimeZone($zone);
        $day = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $timeZone, null, new IntlDatePatternGenerator($dates)->getBestPattern('EEEEMMMd') ?: 'EEEE d MMM');
        $time = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $timeZone, null, 'HH:mm');

        return ($day?->format($moment) ?: $moment->setTimezone($timeZone)->format('l j M')) . ' · ' . ($time?->format($moment) ?: $moment->setTimezone($timeZone)->format('H:i'));
    }

    /** A translated line inside CSS `content`, its page numbers turned into counters. */
    private static function cssString(string $words): string
    {
        $quoted = '"' . Str\replace_every($words, ['\\' => '\\\\', '"' => '\\"']) . '"';

        return Str\replace_every($quoted, ["\u{1}" => '" counter(page) "', "\u{2}" => '" counter(pages) "']);
    }

    private static function e(string $text): string
    {
        return Html\encode_special_characters($text);
    }
}
