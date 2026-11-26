<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Service\OrderMaker;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Entity\StaffItemStation;
use App\Entity\StaffStation;
use App\Enum\ErrorCode;
use App\Enum\MealAnswerKind;
use App\Enum\StationKind;
use App\Locale\NameNormaliser;
use App\Tests\Traits\StoresMealAnswers;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** sc-4005: the orders a firing makes, their items and where each is dished, an item's state, and a held guest's choice. */
final class ServiceOrdersTest extends ServiceTestCase
{
    use StoresMealAnswers;

    #[Test]
    public function firingMakesAnOrderAtToServeForEachArrivedGuestAndALateArrivalGetsTheirsAtOnce(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();

        $table = self::tableOf($this->read());

        self::assertSame(['toServe' => 2, 'dishing' => 0, 'checked' => 0, 'onItsWay' => 0, 'served' => 0], Type\mixed_dict()->coerce($table['counts'])['stages']);
        self::assertSame([OrderMaker::CHEFS_CHOICE, 'jollof rice', 'plantain'], self::itemKeys(Type\mixed_dict()->coerce($this->guestOf($table, 'Adaeze Obi')['order'])));
        self::assertNull($this->guestOf($table, 'Chidi Eze')['order']);
        self::assertSame('notHereYet', $this->guestOf($table, 'Chidi Eze')['noOrder']);

        $this->arrive('Chidi Eze');

        self::assertSame('toServe', $this->orderOf('Chidi Eze')['stage']);
    }

    #[Test]
    public function aGuestWhoChoseNothingForTheCourseHasNoOrderAndSaysSo(): void
    {
        $this->course->setSkippable(true);
        self::em()->persist(new MealAnswer($this->guests['Bola Ade'], $this->course, MealAnswerKind::Skipped, null, null, [], []));
        self::em()->flush();
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();

        $bola = $this->guestOf(self::tableOf($this->read()), 'Bola Ade');

        self::assertNull($bola['order']);
        self::assertSame('nothingForThisCourse', $bola['noOrder']);
        self::assertSame(1, Type\mixed_dict()->coerce(Type\mixed_dict()->coerce($this->read()['counts'])['stages'])['toServe']);
    }

    #[Test]
    public function aPickedOptionAndAVariantAreItemsAnUnansweredOneIsChefsChoiceAndANameSharedWithTheCourseIsOneItem(): void
    {
        $coconut = new MenuDish($this->course, null, 'Coconut rice', null, [], [], 0);
        $beef = new MenuDishVariant($coconut, 'Beef', false, [], [], null, 0);
        $chicken = new MenuDishVariant($coconut, 'Chicken', false, [], [], null, 1);
        $side = new MenuDishChoice($coconut, 'And a side?', 1, true, 0);
        $moimoi = new MenuChoiceOption($side, 'Moi moi', [], 0);
        $coconut->listItems([['kind' => 'fixed', 'name' => 'Coconut rice'], ['kind' => 'variants'], ['kind' => 'choice', 'choiceId' => $side->getId()->toRfc4122()], ['kind' => 'fixed', 'name' => 'plantain ']]);
        $poundedYam = new MenuDish($this->course, null, 'Pounded yam', null, [], [], 1);
        Iter\apply([$coconut, $beef, $chicken, $side, $moimoi, $poundedYam], static fn (object $row) => self::em()->persist($row));
        self::em()->flush();
        $this->picks($beef->getId()->toRfc4122(), $this->guests['Adaeze Obi']);
        $this->picks($moimoi->getId()->toRfc4122(), $this->guests['Adaeze Obi']);
        $this->picks($coconut->getId()->toRfc4122(), $this->guests['Bola Ade']);
        $this->picks($poundedYam->getId()->toRfc4122(), $this->guests['Chidi Eze']);
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze');
        $this->fire();

        self::assertSame(['coconut rice', 'beef', 'moi moi', 'plantain', 'jollof rice'], self::itemKeys($this->orderOf('Adaeze Obi')));
        self::assertSame(['coconut rice', OrderMaker::CHEFS_CHOICE, 'plantain', 'jollof rice'], self::itemKeys($this->orderOf('Bola Ade')), 'no variant and no side: one Chef’s choice');
        self::assertSame(['pounded yam', 'jollof rice', 'plantain'], self::itemKeys($this->orderOf('Chidi Eze')), 'a dish with no items is one item, itself');
    }

    #[Test]
    public function anItemIsDishedAtItsStationAndOneWithNoStationOrChefsChoiceAtThePass(): void
    {
        $grill = new StaffStation($this->event, StationKind::Place, 'Grill', NameNormaliser::key('Grill'), null, 0);
        self::em()->persist($grill);
        self::em()->persist(new StaffItemStation($this->course, 'jollof rice', $grill));
        self::em()->flush();
        $this->arrive('Adaeze Obi');
        $this->fire();

        $stations = Dict\from_entries(Vec\map(
            Type\vec(Type\shape(['key' => Type\string(), 'station' => Type\shape(['name' => Type\string()], true)], true))->coerce($this->read()['items']),
            static fn (array $item): array => [$item['key'], $item['station']['name']],
        ));

        self::assertSame(['jollof rice' => 'Grill', 'plantain' => 'Pass', OrderMaker::CHEFS_CHOICE => 'Pass'], $stations);
    }

    #[Test]
    public function anItemIsPreparingWithOrWithoutATimeAndBackToReadyAndAnyOtherTimeIsRefused(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();

        foreach ([7, 0, 20] as $refused) {
            $this->itemState('plantain', 'preparing', $refused);
            self::assertSame(422, $this->statusCode(), (string) $refused);
        }

        $this->itemState('plantain', 'ready', 5);
        self::assertSame(422, $this->statusCode(), 'a time only with Preparing');
        self::assertSame('ready', $this->item('plantain')['state'], 'nothing changed');

        foreach ([5, 10, 15, null] as $readyIn) {
            $this->itemState('plantain', 'preparing', $readyIn);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
            self::assertSame(['state' => 'preparing', 'readyIn' => $readyIn], Dict\select_keys($this->item('plantain'), ['state', 'readyIn']));
        }

        $this->itemState('plantain', 'ready');
        $item = $this->item('plantain');
        self::assertSame(['ready', '2027-03-06T19:00:00.000+00:00', $this->owner->getId()->toRfc4122()], [$item['state'], $item['changedAt'], $item['changedBy']]);
    }

    #[Test]
    public function aGuestIsHeldWhileAnItemIsPreparingAndReleasedWhenItIsReady(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();

        $this->itemState('plantain', 'preparing', 10);
        $order = $this->orderOf('Adaeze Obi');
        self::assertTrue($order['held']);
        self::assertSame(['plantain'], $order['holding']);
        self::assertSame('toServe', $order['stage'], 'held is never a stage');
        self::assertSame(1, Type\mixed_dict()->coerce($this->read()['counts'])['held']);

        $this->post('/course/' . $this->courseId() . '/trays', ['table' => $this->tableKey()]);
        $this->assertRefused(409, ErrorCode::TableNothingToServe->type());

        $this->itemState('plantain', 'ready');
        self::assertFalse($this->orderOf('Adaeze Obi')['held']);
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->startTray()['plates']));
    }

    #[Test]
    public function waitForAllKeepsTheGuestHeldAndTheChoiceCanBeMadeAgain(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $this->itemState('plantain', 'preparing');
        $order = Type\string()->coerce($this->orderOf('Adaeze Obi')['id']);

        $this->put('/plates/' . $order . '/choice', ['choice' => 'waitForAll']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([true, 'waitForAll'], [$this->orderOf('Adaeze Obi')['held'], $this->orderOf('Adaeze Obi')['choice']]);

        $this->put('/plates/' . $order . '/choice', ['choice' => 'whatsReadyNow']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([false, 'whatsReadyNow'], [$this->orderOf('Adaeze Obi')['held'], $this->orderOf('Adaeze Obi')['choice']], 'the last choice stands');
    }

    #[Test]
    public function whatsReadyNowIsRefusedWhileNothingOnTheOrderIsReady(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();

        foreach (['plantain', 'jollof rice', OrderMaker::CHEFS_CHOICE] as $item) {
            $this->itemState($item, 'preparing');
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }

        $this->put('/plates/' . Type\string()->coerce($this->orderOf('Adaeze Obi')['id']) . '/choice', ['choice' => 'whatsReadyNow']);
        $this->assertRefused(409, ErrorCode::PlateEmpty->type());
        self::assertNull($this->orderOf('Adaeze Obi')['choice'], 'nothing changed');
    }

    #[Test]
    public function whatsReadyNowSendsWhatIsReadyAndOwesTheRestToFollowOnceTheOrderIsServed(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $this->itemState('plantain', 'preparing', 10);
        $order = Type\string()->coerce($this->orderOf('Adaeze Obi')['id']);
        $this->put('/plates/' . $order . '/choice', ['choice' => 'whatsReadyNow']);

        $tray = $this->startTray();
        self::assertSame([[$order, OrderMaker::CHEFS_CHOICE], [$order, 'jollof rice']], Vec\map(self::marksOf($tray), static fn (array $one): array => [$one['plateId'], $one['item']]), 'Plantain is To follow: not on the plate, and no mark');
        $this->toTheTable($tray);
        self::assertSame([], $this->owed('Adaeze Obi'), 'nothing owed before the order is Served');

        $this->post('/trays/' . Type\string()->coerce($tray['id']) . '/plates/' . $order . '/served');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $owed = $this->owed('Adaeze Obi');
        self::assertCount(1, $owed);
        self::assertSame(['toFollow', ['plantain'], 'toServe'], [$owed[0]['owedReason'], self::itemKeys($owed[0]), $owed[0]['stage']]);
        self::assertSame([], Type\vec(Type\mixed())->coerce(self::tableOf($this->read())['plates']), 'Plantain is still Preparing, so the owed plate waits');

        $this->itemState('plantain', 'ready');
        self::assertSame($owed[0]['id'], Type\vec(Type\mixed_dict())->coerce(self::tableOf($this->read())['plates'])[0]['id']);
    }

    /** @return array<array-key, mixed> */
    private function item(string $key): array
    {
        $items = Type\vec(Type\mixed_dict())->coerce($this->read()['items']);

        return Iter\search($items, static fn (array $item): bool => $item['key'] === $key) ?? self::fail('no item ' . $key);
    }

    /** @return list<array<array-key, mixed>> */
    private function owed(string $name): array
    {
        return Type\vec(Type\mixed_dict())->coerce($this->orderOf($name)['owed']);
    }
}
