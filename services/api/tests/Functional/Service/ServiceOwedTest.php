<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Entity\MenuCourse;
use App\Enum\ErrorCode;
use App\Tests\Double\Messaging\RecordingHub;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mercure\Update;

/** sc-4005: plates owed to a guest, Brought after, To follow or sent back, and the undo of a step. */
final class ServiceOwedTest extends ServiceTestCase
{
    #[Test]
    public function anItemToBringAfterIsOwedOnceTheOrderIsServedAndGoesFirstOnTheNextTray(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola');
        $this->fire();
        $tray = $this->startTray();
        $first = Type\string()->coerce(Type\vec(Type\mixed())->coerce($tray['plates'])[0]);
        $this->markAll($tray, 'on');
        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $first, 'item' => 'plantain', 'mark' => 'bringAfter']);
        $this->post('/trays/' . self::id($tray) . '/check');
        $this->post('/trays/' . self::id($tray) . '/take-to-table');
        self::assertSame([], $this->orderOf('Adaeze Obi')['owed'], 'nothing is owed before the plate is Served');

        $this->post('/trays/' . self::id($tray) . '/plates/' . $first . '/served');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $waiting = $this->waiting();
        self::assertSame(['bringAfter', ['plantain'], '2027-03-06T19:00:00.000+00:00'], [$waiting[0]['owedReason'], self::itemKeys($waiting[0]), $waiting[0]['owedAt']]);
        self::assertSame($waiting[0]['id'], Type\vec(Type\mixed_dict())->coerce($this->orderOf('Adaeze Obi')['owed'])[0]['id'], 'returned with its guest');
        self::assertSame([$waiting[0]['id'], $waiting[1]['id']], Vec\take(Type\vec(Type\mixed())->coerce($this->startTray()['plates']), 2), 'owed plates first');
    }

    #[Test]
    public function owedPlatesGoOldestFirstAndCountTowardThePlatesPerTrip(): void
    {
        $this->arrive(...self::GUESTS);
        $this->fire();
        $tray = $this->startTray();
        $this->toTheTable($tray);
        $this->post('/trays/' . self::id($tray) . '/all-served');
        [$adaeze, $bola, $chidi] = Type\vec(Type\string())->coerce($tray['plates']);

        $this->post('/plates/' . $chidi . '/sent-back', ['reason' => 'notRight']);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:00:30Z'));
        $this->post('/plates/' . $adaeze . '/sent-back', ['reason' => 'wrongDish']);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:01:00Z'));
        $this->post('/plates/' . $bola . '/sent-back', ['reason' => 'dropped']);

        self::assertSame([$chidi, $adaeze, $bola], $this->startTray()['plates'], 'three owed plates fill the tray, oldest first, ahead of the two orders');
    }

    #[Test]
    public function anOwedPlateRidesTheNextCoursesTrayAndIsInBothReads(): void
    {
        $dessert = new MenuCourse($this->event, 'Dessert', null, 1);
        $dessert->listOwnItems(['Puff-puff']);
        self::em()->persist($dessert);
        self::em()->flush();
        $this->arrive('Adaeze Obi');
        $this->fire();
        $tray = $this->startTray();
        $this->toTheTable($tray);
        $plate = Type\string()->coerce(Type\vec(Type\mixed())->coerce($tray['plates'])[0]);
        $this->post('/trays/' . self::id($tray) . '/all-served');
        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'notRight']);
        $this->fire($dessert);

        $next = $this->startTray(null, $dessert);

        self::assertSame($plate, Type\vec(Type\mixed())->coerce($next['plates'])[0], 'the Main plate goes first, on the Dessert tray');
        self::assertCount(2, Type\vec(Type\mixed())->coerce($next['plates']));
        self::assertSame(self::id($next), self::trayOf($this->read(), self::id($next))['id'], 'in the Main read');
        self::assertSame(self::id($next), self::trayOf($this->read($dessert), self::id($next))['id'], 'and in the Dessert read');
        self::assertSame('dishing', $this->orderOf('Adaeze Obi')['stage']);
    }

    #[Test]
    public function eachReasonSendsAPlateBackFromOnItsWayOrServedAndEachSendingIsKept(): void
    {
        foreach (['wrongDish', 'notRight', 'dropped', 'allergyConcern'] as $at => $reason) {
            foreach (['onItsWay', 'served'] as $from) {
                $plate = $this->plateAt($from);
                $this->post('/plates/' . $plate . '/sent-back', ['reason' => $reason]);
                self::assertSame(200, $this->statusCode(), $reason . ' from ' . $from . ': ' . Json\encode($this->last()));
                $order = $this->orderOf('Adaeze Obi');
                self::assertSame(['toServe', null, 'sentBack'], [$order['stage'], $order['trayId'], $order['owedReason']], $reason . ' from ' . $from);
                self::assertSame($reason, Type\vec(Type\mixed_dict())->coerce($order['sentBack'])[($at * 2) + ('served' === $from ? 1 : 0)]['reason']);
            }
        }

        self::assertCount(8, Type\vec(Type\mixed())->coerce($this->orderOf('Adaeze Obi')['sentBack']), 'every sending kept, on one plate');
    }

    #[Test]
    public function anAllergyConcernIsAlertedOnTheServiceTopic(): void
    {
        $plate = $this->plateAt('served');
        $hub = self::service(RecordingHub::class);
        $hub->published = [];

        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'allergyConcern']);

        $alerts = Vec\filter(Vec\map($hub->published, static fn (Update $update): array => [$update->getTopics(), Type\mixed_dict()->coerce(Json\decode($update->getData()))]), static fn (array $one): bool => isset($one[1]['alert']));
        self::assertCount(1, $alerts);
        [$topics, $data] = Vec\values($alerts)[0];
        self::assertSame(['events/' . $this->event->getId()->toRfc4122() . '/service'], $topics);
        self::assertSame(['allergyConcern', $plate, $this->tableKey()], Vec\map(['reason', 'plateId', 'table'], static fn (string $key): mixed => Type\mixed_dict()->coerce($data['alert'])[$key]));

        $hub->published = [];
        $this->post('/plates/' . $this->plateAt('served') . '/sent-back', ['reason' => 'dropped']);
        self::assertFalse(Iter\any($hub->published, static fn (Update $update): bool => isset(Type\mixed_dict()->coerce(Json\decode($update->getData()))['alert'])), 'only an Allergy concern alerts');
    }

    #[Test]
    public function undoingASendBackPutsBackTheStageAndTimesThePlateHadWithinTwoMinutes(): void
    {
        $plate = $this->plateAt('served');
        $before = $this->orderOf('Adaeze Obi');
        self::mockTime(new DateTimeImmutable('2027-03-06T19:01:00Z'));

        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'allergyConcern']);
        self::assertSame('toServe', $this->orderOf('Adaeze Obi')['stage']);

        $this->post('/undo', ['subject' => $plate]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        $after = $this->orderOf('Adaeze Obi');
        self::assertSame([$before['stage'], $before['steps'], $before['owedReason'], $before['owedAt'], []], [$after['stage'], $after['steps'], $after['owedReason'], $after['owedAt'], $after['sentBack']]);

        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'dropped']);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:03:01Z'));
        $this->post('/undo', ['subject' => $plate]);
        $this->assertRefused(409, ErrorCode::UndoExpired->type());
        self::assertSame('toServe', $this->orderOf('Adaeze Obi')['stage'], 'nothing changed');
    }

    #[Test]
    public function undoReversesOneMarkAndOnlyTheLastStepOnASubject(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $tray = $this->startTray();
        $plate = Type\string()->coerce(Type\vec(Type\mixed())->coerce($tray['plates'])[0]);
        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'on']);
        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'notOn']);

        $this->post('/undo', ['subject' => $plate]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('on', $this->markOf(self::id($tray), $plate, 'plantain'));

        $this->post('/undo', ['subject' => self::id($tray)]);
        $this->assertRefused(409, ErrorCode::Conflict->type());
        self::assertSame('dishing', $this->orderOf('Adaeze Obi')['stage'], 'the start is not undone over a later mark');
    }

    /** @return string Adaeze's order, taken alone to the table, and Served if asked */
    private function plateAt(string $stage): string
    {
        if (null === $this->guestOf(self::tableOf($this->read()), 'Adaeze Obi')['order']) {
            $this->arrive('Adaeze Obi');
            $this->fire();
        }

        $tray = $this->startTray();
        $plate = Type\string()->coerce(Type\vec(Type\mixed())->coerce($tray['plates'])[0]);
        $this->toTheTable($tray);

        if ('served' === $stage) {
            $this->post('/trays/' . self::id($tray) . '/plates/' . $plate . '/served');
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }

        return $plate;
    }

    private function markOf(string $trayId, string $plate, string $item): mixed
    {
        $marks = self::marksOf(self::trayOf($this->read(), $trayId));
        $mark = Iter\search($marks, static fn (array $one): bool => $one['plateId'] === $plate && $one['item'] === $item) ?? self::fail('no mark');

        return Type\mixed_dict()->coerce($mark)['mark'] ?? null;
    }

    /** @return list<array<array-key, mixed>> */
    private function waiting(): array
    {
        return Type\vec(Type\mixed_dict())->coerce(self::tableOf($this->read())['plates']);
    }

    /** @param array<array-key, mixed> $tray */
    private static function id(array $tray): string
    {
        return Type\string()->coerce($tray['id']);
    }
}
