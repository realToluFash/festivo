<?php

declare(strict_types=1);

namespace App\Domain\Menu\Kitchen;

use App\Domain\Event\EventDay;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Entity\Event;
use App\Entity\KitchenCopy;
use App\Entity\KitchenFinalNumbers;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventDayRefusal;
use App\Enum\Paper;
use App\Http\Exception\ApiException;
use App\Repository\KitchenCopyRepository;
use App\Repository\KitchenFinalNumbersRepository;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Final numbers due, and the copies of the kitchen sheet given to the kitchen (sc-30812). Soirely sends nothing: the host passes the PDF on.
 *
 * @phpstan-import-type Sheet from KitchenSheet
 * @phpstan-import-type SheetCourse from KitchenSheet
 * @phpstan-import-type Since from KitchenSinceCopy
 *
 * @phpstan-type Given array{id: string, recordedAt: string, by: string}
 * @phpstan-type Final array{due: ?string, picksOpenUntil: ?string, copies: list<Given>, changes: ?Since}
 */
final readonly class FinalNumbers
{
    public function __construct(
        private KitchenFinalNumbersRepository $kitchenFinalNumbersRepository,
        private KitchenCopyRepository $kitchenCopyRepository,
        private MenuSerialiser $menuSerialiser,
        private KitchenSinceCopy $kitchenSinceCopy,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /**
     * @param ?Sheet $now the sheet with its names, when the caller has it
     * @return Final `picksOpenUntil` is the last course's close while the due day falls before its day, both in the event's zone; `changes` the sheet now against the latest copy, null with none
     */
    public function of(Event $event, bool $names, ?array $now = null): array
    {
        $due = $this->kitchenFinalNumbersRepository->findOneForEvent($event)?->getDueOn();
        $zone = new DateTimeZone($event->getTimeZone());
        $lastClose = $this->lastClose($event);

        return [
            'due' => $due?->format('Y-m-d'),
            'picksOpenUntil' => null !== $due && null !== $lastClose && $due->format('Y-m-d') < $lastClose->setTimezone($zone)->format('Y-m-d') ? $lastClose->setTimezone($zone)->format(\DATE_ATOM) : null,
            'copies' => Vec\map($this->kitchenCopyRepository->findForEvent($event), static fn (KitchenCopy $copy): array => [
                'id' => $copy->getId()->toRfc4122(),
                'recordedAt' => $copy->getRecordedAt()->setTimezone($zone)->format(\DATE_ATOM),
                'by' => $copy->getRecordedByName(),
            ]),
            'changes' => $this->changes($event, $names, $now),
        ];
    }

    /** Before the event's first day, both in its zone; a new or changed day not before today there. A day left as it is stands, passed or moved past by the event's own dates. Refused 422 on `due`. */
    public function setDue(Event $event, ?string $typed): void
    {
        $this->entityManager->wrapInTransaction(function () use ($event, $typed): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $final = $this->kitchenFinalNumbersRepository->findOneForEvent($event) ?? new KitchenFinalNumbers($event);
            $final->setDueOn($this->due($event, $typed, $final->getDueOn()?->format('Y-m-d')));
            $this->entityManager->persist($final);
            $this->entityManager->flush();
        });
    }

    /**
     * @param ?Sheet $now the sheet with its names, when the caller has it
     *
     * @return ?Since the changes since the latest copy under this reader's names rule; null before a first copy
     */
    public function changes(Event $event, bool $names, ?array $now = null): ?array
    {
        $copy = $this->kitchenCopyRepository->findLatestForEvent($event);

        if (null === $copy) {
            return null;
        }

        $since = $this->kitchenSinceCopy->of($event, $copy, $now);

        return ['since' => $since['since'], 'lines' => KitchenChanges::forReader($since['lines'], $names)];
    }

    /**
     * @param Sheet  $sheet   the sheet with its names, whoever records it; a recorder without guests.manage keeps its rows with no name or words of theirs, so the next change is found person by person
     * @param ?Since $changes the copy's changes page, under the recorder's names rule
     */
    public function record(Event $event, array $sheet, User $by, bool $names, ?array $changes): KitchenCopy
    {
        $now = $this->clock->now();
        $held = [...$sheet, 'asOf' => $now->setTimezone(new DateTimeZone($event->getTimeZone()))->format(\DATE_ATOM), 'paper' => $sheet['paper']->value];

        if (!$names) {
            $held = [...$held, 'names' => false, 'allergic' => null, 'people' => Vec\map($sheet['allergic'] ?? [], static fn (array $one): array => ['id' => $one['id'], 'allergens' => $one['allergens'], 'diets' => $one['diets']])];
        }

        if (null !== $changes) {
            $held['changes'] = $changes;
        }

        $copy = new KitchenCopy($event, $now, $by, $names, $held);
        $final = $this->kitchenFinalNumbersRepository->findOneForEvent($event) ?? new KitchenFinalNumbers($event);
        // This copy holds every change, so a difference that follows is a new one.
        $final->setDiffersSince(null);
        $this->entityManager->persist($final);
        $this->entityManager->persist($copy);
        $this->entityManager->flush();

        return $copy;
    }

    /** @return Sheet the copy as given; names only when its recorder and this reader both hold guests.manage */
    public function sheetOf(KitchenCopy $copy, bool $readerNames): array
    {
        $held = $copy->getSheet();
        $names = $readerNames && $copy->heldNames();
        $counts = Type\vec(Type\shape(['code' => Type\string(), 'count' => Type\int()]));
        $allergic = Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'allergens' => Type\vec(Type\string()),
            'otherAllergy' => Type\nullable(Type\string()),
            'diets' => Type\vec(Type\string()),
            'otherDiet' => Type\nullable(Type\string()),
            'cells' => Type\vec(Type\shape(['kind' => Type\string(), 'text' => Type\optional(Type\string())])),
        ]));

        return [
            'asOf' => Type\string()->coerce($held['asOf'] ?? null),
            'paper' => Paper::from(Type\string()->coerce($held['paper'] ?? null)),
            'names' => $names,
            'coming' => Type\int()->coerce($held['coming'] ?? null),
            'allergicCount' => Type\int()->coerce($held['allergicCount'] ?? null),
            'allergic' => $names ? $allergic->coerce($held['allergic'] ?? []) : null,
            'allergyCounts' => $counts->coerce($held['allergyCounts'] ?? []),
            'dietCounts' => $counts->coerce($held['dietCounts'] ?? []),
            'courses' => self::coursesType()->coerce($held['courses'] ?? []),
        ];
    }

    /** @return ?Since the copy's changes page as given, read under the same names rule as the rest of it */
    public function changesOf(KitchenCopy $copy, bool $readerNames): ?array
    {
        $held = Type\nullable(Type\shape(['since' => Type\string(), 'lines' => KitchenChanges::linesType()]))->coerce($copy->getSheet()['changes'] ?? null);

        return null === $held ? null : ['since' => $held['since'], 'lines' => KitchenChanges::forReader($held['lines'], $readerNames && $copy->heldNames())];
    }

    /** @return Type\TypeInterface<list<SheetCourse>> */
    public static function coursesType(): Type\TypeInterface
    {
        return Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'rows' => Type\vec(Type\shape(['id' => Type\string(), 'kind' => Type\string(), 'name' => Type\string(), 'count' => Type\int()])),
            'kitchen' => Type\int(),
            'skipped' => Type\int(),
            'needsHost' => Type\int(),
            'notChosen' => Type\int(),
            'menuChanged' => Type\int(),
            'never' => Type\bool(),
            'room' => Type\int(),
            'given' => Type\nullable(Type\shape(['count' => Type\int(), 'plate' => Type\string()])),
            'sides' => Type\bool(),
            'stations' => Type\nullable(Type\vec(Type\shape([
                'id' => Type\string(),
                'name' => Type\string(),
                'lines' => Type\vec(Type\shape(['name' => Type\string(), 'count' => Type\int(), 'chefs' => Type\bool()])),
            ]))),
        ]));
    }

    /** The moment the due day ends: 23:59 in the event's zone. */
    public static function endOf(string $day, DateTimeZone $zone): DateTimeImmutable
    {
        return new DateTimeImmutable($day . ' 23:59:00', $zone);
    }

    private function lastClose(Event $event): ?DateTimeImmutable
    {
        $closes = Vec\filter_nulls(Vec\map(
            $this->menuSerialiser->menu($event)['courses'],
            static fn (array $course): ?string => Type\nullable(Type\shape(['at' => Type\string()], true))->coerce($course['picksClose'] ?? null)['at'] ?? null,
        ));

        if ([] === $closes) {
            return null;
        }

        return Vec\sort_by(Vec\map($closes, static fn (string $at): DateTimeImmutable => new DateTimeImmutable($at)), static fn (DateTimeImmutable $at): int => -$at->getTimestamp())[0];
    }

    private function due(Event $event, ?string $typed, ?string $was): ?DateTimeImmutable
    {
        if (null === $typed || '' === Str\trim($typed)) {
            return null;
        }

        if (Str\trim($typed) === $was) {
            return new DateTimeImmutable($was, new DateTimeZone('UTC'));
        }

        $day = EventDay::before($event, $typed, $this->clock);

        return $day instanceof EventDayRefusal ? throw $this->dueRefused(match ($day) {
            EventDayRefusal::Invalid => 'validation.final_numbers_invalid',
            EventDayRefusal::Past => 'validation.final_numbers_past',
            EventDayRefusal::NotBeforeEvent => 'validation.final_numbers_not_before_event',
        }) : $day;
    }

    private function dueRefused(string $key): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => 'due',
            'message' => $this->translator->trans($key),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
