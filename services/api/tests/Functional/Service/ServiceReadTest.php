<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Service\ServiceRead;
use App\Entity\MenuCourse;
use App\Entity\SeatingSection;
use App\Enum\SectionColour;
use App\Locale\NameNormaliser;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Fixtures\Service\AppliedPatch;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mercure\Update;

/** sc-4005: the one read's counts, and the patch every change publishes to it. */
final class ServiceReadTest extends ServiceTestCase
{
    #[Test]
    public function theCountsByStageAndHeldPerTableSectionAndCourseAndTheLongestWait(): void
    {
        $sectionB = new SeatingSection($this->plan, 'Section B', NameNormaliser::key('Section B'), SectionColour::Blue, null);
        self::em()->persist($sectionB);
        $tableB = $this->tableIn($sectionB, 'Table 2');
        $this->seat('Funmi Bello', $tableB, 1);
        self::em()->flush();
        $this->arrive(...[...self::GUESTS, 'Funmi Bello']);
        $this->fire();
        $this->fire(null, $tableB);

        self::mockTime(new DateTimeImmutable('2027-03-06T19:05:00Z'));
        $tray = $this->startTray();
        $this->toTheTable($tray);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:06:00Z'));
        $this->post('/trays/' . Type\string()->coerce($tray['id']) . '/plates/' . Type\vec(Type\string())->coerce($tray['plates'])[0] . '/served');
        self::mockTime(new DateTimeImmutable('2027-03-06T19:10:00Z'));
        $this->startTray(self::keyOf($tableB));
        $this->itemState('plantain', 'preparing', 10);

        $read = $this->read();
        $tableA = self::tableOf($read, $this->tableKey());
        $tableTwo = self::tableOf($read, self::keyOf($tableB));
        $one = ['stages' => ['toServe' => 2, 'dishing' => 0, 'checked' => 0, 'onItsWay' => 2, 'served' => 1], 'held' => 2];
        $two = ['stages' => ['toServe' => 0, 'dishing' => 1, 'checked' => 0, 'onItsWay' => 0, 'served' => 0], 'held' => 0];

        self::assertSame([$one, '2027-03-06T19:00:00.000+00:00'], [$tableA['counts'], $tableA['waitingSince']]);
        self::assertSame([$two, '2027-03-06T19:10:00.000+00:00'], [$tableTwo['counts'], $tableTwo['waitingSince']]);
        self::assertSame([['id' => $this->section->getId()->toRfc4122(), 'counts' => $one], ['id' => $sectionB->getId()->toRfc4122(), 'counts' => $two]], $read['sections']);
        self::assertSame(['stages' => ['toServe' => 2, 'dishing' => 1, 'checked' => 0, 'onItsWay' => 2, 'served' => 1], 'held' => 2], $read['counts']);
    }

    #[Test]
    public function aClientThatAppliesEachPatchHasWhatARefetchReturns(): void
    {
        $dessert = new MenuCourse($this->event, 'Dessert', null, 1);
        $dessert->listOwnItems(['Puff-puff']);
        self::em()->persist($dessert);
        self::em()->flush();
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola');
        $tray = [];
        $plate = '';
        $steps = [
            'the firing' => $this->fire(...),
            'a late arrival, at the door' => fn () => $this->arriveAtTheDoor('Ese Ugo'),
            'an item Preparing' => fn () => $this->itemState('plantain', 'preparing', 15),
            'a choice' => fn () => $this->put('/plates/' . Type\string()->coerce($this->orderOf('Dayo Ola')['id']) . '/choice', ['choice' => 'whatsReadyNow']),
            'an item Ready' => fn () => $this->itemState('plantain', 'ready'),
            'a start' => function () use (&$tray): void {
                $tray = $this->startTray();
            },
            'a mark' => function () use (&$tray, &$plate): void {
                $plate = Type\vec(Type\string())->coerce($tray['plates'])[0];
                $this->put('/trays/' . Type\string()->coerce($tray['id']) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'bringAfter']);
            },
            'a plate taken off' => function () use (&$tray): void {
                $this->takeOff(Type\string()->coerce($tray['id']), Type\vec(Type\string())->coerce($tray['plates'])[2]);
            },
            'the rest to the table' => function () use (&$tray): void {
                $marks = Vec\filter(self::marksOf(self::trayOf($this->read(), Type\string()->coerce($tray['id']))), static fn (array $one): bool => null === (Type\mixed_dict()->coerce($one)['mark'] ?? null));

                foreach ($marks as $one) {
                    $this->put('/trays/' . Type\string()->coerce($tray['id']) . '/marks', [...Type\mixed_dict()->coerce($one), 'mark' => 'on']);
                }

                $this->post('/trays/' . Type\string()->coerce($tray['id']) . '/check');
                $this->post('/trays/' . Type\string()->coerce($tray['id']) . '/take-to-table');
            },
            'all served' => function () use (&$tray): void {
                $this->post('/trays/' . Type\string()->coerce($tray['id']) . '/all-served');
            },
            'a send-back' => function () use (&$plate): void {
                $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'wrongDish']);
            },
            'its undo' => function () use (&$plate): void {
                $this->post('/undo', ['subject' => $plate]);
            },
            'the next course fired' => fn () => $this->fire($dessert),
            'its tray, with the owed plate' => fn () => $this->startTray(null, $dessert),
        ];

        foreach ($steps as $what => $step) {
            $before = [$this->courseId() => $this->read(), $this->courseId($dessert) => $this->read($dessert)];
            $hub = self::service(RecordingHub::class);
            $hub->published = [];

            $step();

            self::assertLessThan(300, $this->statusCode(), $what . ': ' . Json\encode($this->last()));
            $patched = $before;

            foreach ($hub->published as $update) {
                $data = Type\mixed_dict()->coerce(Json\decode($update->getData()));

                if (isset($data['patch'])) {
                    $course = Type\string()->coerce($data['course']);
                    $patched[$course] = AppliedPatch::to($patched[$course], Type\vec(Type\shape(['op' => Type\string(), 'path' => Type\string(), 'value' => Type\optional(Type\mixed())]))->coerce($data['patch']));
                }
            }

            self::assertNotSame([], Vec\filter($hub->published, static fn (Update $update): bool => isset(Type\mixed_dict()->coerce(Json\decode($update->getData()))['patch'])), $what . ' published nothing');
            self::assertSame(self::unphased($this->read()), self::unphased($patched[$this->courseId()]), $what . ', the Main');
            self::assertSame(self::unphased($this->read($dessert)), self::unphased($patched[$this->courseId($dessert)]), $what . ', the Dessert');
        }
    }

    #[Test]
    public function anArrivalBeforeAnyFiringIsStoredAndPublishesNoPatch(): void
    {
        $hub = self::service(RecordingHub::class);
        $hub->published = [];

        $this->arriveAtTheDoor('Adaeze Obi');

        self::assertSame([], Vec\filter($hub->published, static fn (Update $update): bool => isset(Type\mixed_dict()->coerce(Json\decode($update->getData()))['patch'])));
        self::assertNull($this->guestOf(self::tableOf($this->read()), 'Adaeze Obi')['noOrder']);

        $this->fire();

        self::assertSame('toServe', $this->orderOf('Adaeze Obi')['stage']);
    }

    #[Test]
    public function theReadThePatchIsMadeFromNamesNobody(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();

        self::assertStringNotContainsString('Adaeze', Json\encode(self::service(ServiceRead::class)->of(self::em()->find(MenuCourse::class, $this->course->getId()) ?? self::fail('no course'), null)));
        self::assertSame('Adaeze Obi', $this->guestOf(self::tableOf($this->read()), 'Adaeze Obi')['name']);
    }

    /**
     * The phase moves with the clock and the event, not with a step, so no patch carries it (sc-4028).
     *
     * @param array<array-key, mixed> $read
     *
     * @return array<array-key, mixed>
     */
    private static function unphased(array $read): array
    {
        unset($read['phase']);

        return $read;
    }
}
