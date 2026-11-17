<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Guests in chairs (sc-4013): seating a guest and their party, full and short tables, swap, move, Undo, the chairs freed by Not coming and by removal, and the seats a table or row keeps while guests sit in them. */
final class SeatingGuestsTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent($this->owner, $this->organisation);
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aGuestSitsInTheTablesFirstFreeChairAndEveryOpenPlanHearsOfIt(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', reply: 'coming');

        $answer = $this->seat($ada, $table);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([['guestId' => $ada, 'from' => null, 'to' => ['kind' => 'table', 'id' => $table, 'seat' => 1]]], $answer['moves']);
        self::assertFalse($answer['apart']);
        self::assertSame([[1, $ada]], $this->seatedAt($table));
        self::assertSame(1, $this->planNow()['counts']['seatedGuests']);
        self::assertSame(['kind' => 'table', 'id' => $table, 'seat' => 1], $this->guestNow($ada)['seat']);

        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/seating'], $update->getTopics());
        self::assertStringContainsString($ada, $update->getData());
    }

    #[Test]
    public function aPartySitsSideBySideFromTheTopAndAChosenChairSeatsThemFromThere(): void
    {
        $table = $this->addTable();
        $first = $this->guest('Bola Ade');
        $this->seat($first, $table, seat: 2);
        $ada = $this->guest('Ada Obi', ['Chidi Obi', null]);

        $answer = $this->seat($ada, $table);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([3, 4, 5], Vec\map($answer['moves'], static fn (array $move): int => Type\int()->coerce(Type\dict(Type\string(), Type\mixed())->coerce($move['to'])['seat'])));
        self::assertSame($ada, $answer['moves'][0]['guestId']);
        self::assertFalse($answer['apart']);

        $kemi = $this->guest('Kemi Ade', ['Tunde Ade']);
        $chosen = $this->seat($kemi, $table, seat: 9);
        self::assertSame([9, 10], Vec\map($chosen['moves'], static fn (array $move): int => Type\int()->coerce(Type\dict(Type\string(), Type\mixed())->coerce($move['to'])['seat'])));
    }

    #[Test]
    public function aTableWithRoomButNoRunSeatsThePartyInItsFirstFreeChairsAndSaysSo(): void
    {
        $table = $this->addTable(seats: 4);
        $this->seat($this->guest('One'), $table, seat: 1);
        $this->seat($this->guest('Three'), $table, seat: 3);
        $ada = $this->guest('Ada Obi', ['Chidi Obi']);

        $answer = $this->seat($ada, $table);

        self::assertSame(200, $this->statusCode());
        self::assertTrue($answer['apart']);
        self::assertSame([[1, 'One'], [2, 'Ada Obi'], [3, 'Three'], [4, 'Chidi Obi']], $this->namesAt($table));
    }

    #[Test]
    public function aRoundTablesRunWrapsPastItsLastChair(): void
    {
        $table = $this->addTable(seats: 4);
        $this->seat($this->guest('Two'), $table, seat: 2);
        $this->seat($this->guest('Three'), $table, seat: 3);

        $answer = $this->seat($this->guest('Ada Obi', ['Chidi Obi']), $table);

        self::assertFalse($answer['apart']);
        self::assertSame([[1, 'Chidi Obi'], [2, 'Two'], [3, 'Three'], [4, 'Ada Obi']], $this->namesAt($table));
    }

    #[Test]
    public function aFullTableIsRefusedAndNothingChanges(): void
    {
        $table = $this->addTable(seats: 1);
        $this->seat($this->guest('Bola Ade'), $table);
        $ada = $this->guest('Ada Obi');

        $this->seat($ada, $table);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_table_full', $this->last()['type'] ?? null);
        self::assertSame('Table 1 is full. Pick another table, or move someone off it first.', $this->last()['detail'] ?? null);
        self::assertNull($this->guestNow($ada)['seat']);
    }

    #[Test]
    public function aShortTableSaysSoAndSeatsJustTheLeadWhenAsked(): void
    {
        $table = $this->addTable(seats: 3);
        $this->seat($this->guest('Bola Ade'), $table);
        $ada = $this->guest('Ada Obi', ['Chidi Obi', 'Nneka Obi']);

        $this->seat($ada, $table);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_table_short', $this->last()['type'] ?? null);
        self::assertSame('Table 1 has 2 free seats. Ada Obi’s party is 3.', $this->last()['detail'] ?? null);
        self::assertSame([2, 3], [$this->last()['free'] ?? null, $this->last()['party'] ?? null]);
        self::assertSame([[1, 'Bola Ade']], $this->namesAt($table));

        $answer = $this->seat($ada, $table, justGuest: true);

        self::assertSame(200, $this->statusCode());
        self::assertCount(1, $answer['moves']);
        self::assertSame([[1, 'Bola Ade'], [2, 'Ada Obi']], $this->namesAt($table));
    }

    #[Test]
    public function aTakenChairIsRefusedAsTakenAndAnUnusableOneCannotBeChosen(): void
    {
        $table = $this->addTable();
        $bola = $this->guest('Bola Ade');
        $this->seat($bola, $table, seat: 4);
        $ada = $this->guest('Ada Obi');

        $this->seat($ada, $table, seat: 4);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_seat_taken', $this->last()['type'] ?? null);
        self::assertSame('Someone just took that seat. Ada Obi is still without a seat.', $this->last()['detail'] ?? null);
        self::assertSame($bola, $this->last()['takenBy'] ?? null);

        $this->changeTable($table, ['unusableSeats' => [5]]);
        $this->seat($ada, $table, seat: 5);
        self::assertSame(422, $this->statusCode());
        self::assertNull($this->guestNow($ada)['seat']);
    }

    #[Test]
    public function aSeatedGuestMovesAloneAndTheirPartyStays(): void
    {
        $one = $this->addTable();
        $two = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi']);
        $this->seat($ada, $one);

        $answer = $this->seat($ada, $two);

        self::assertSame([['guestId' => $ada, 'from' => ['kind' => 'table', 'id' => $one, 'seat' => 1], 'to' => ['kind' => 'table', 'id' => $two, 'seat' => 1]]], $answer['moves']);
        self::assertSame([[2, 'Chidi Obi']], $this->namesAt($one));
        self::assertSame([[1, 'Ada Obi']], $this->namesAt($two));
    }

    #[Test]
    public function swappingTradesChairsAndAnUnseatedGuestSendsTheOtherToWithoutASeat(): void
    {
        $one = $this->addTable();
        $two = $this->addTable();
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $kemi = $this->guest('Kemi Ade');
        $this->seat($ada, $one, seat: 3);
        $this->seat($bola, $two, seat: 5);

        $this->swap($ada, $bola);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[3, 'Bola Ade']], $this->namesAt($one));
        self::assertSame([[5, 'Ada Obi']], $this->namesAt($two));

        $this->swap($kemi, $bola);
        self::assertSame([[3, 'Kemi Ade']], $this->namesAt($one));
        self::assertNull($this->guestNow($bola)['seat']);
    }

    #[Test]
    public function undoPutsBackExactlyWhatWasThereAndRefusesWhenTheSeatsChangedSince(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi']);
        $seated = $this->seat($ada, $table);

        $this->undo($seated['moves']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([], $this->namesAt($table));

        $this->seat($ada, $table);
        $this->seat($this->guest('Bola Ade'), $table, seat: 9);
        $moved = $this->seat($ada, $this->addTable());
        $this->seat($this->guest('Kemi Ade'), $table, seat: 1);

        $this->undo($moved['moves']);

        self::assertSame(409, $this->statusCode());
        self::assertSame('These seats changed since. Nothing was undone.', $this->last()['detail'] ?? null);
        self::assertSame([[1, 'Kemi Ade'], [2, 'Chidi Obi'], [9, 'Bola Ade']], $this->namesAt($table));
    }

    #[Test]
    public function undoIsRefusedForAGuestWhoIsNoLongerComing(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi');
        $this->seat($ada, $table);
        $unseated = $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['guestIds' => [$ada]]);
        $this->reply($ada, 'notComing');

        $this->undo(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($unseated['moves']));

        self::assertSame(409, $this->statusCode());
        self::assertSame([], $this->namesAt($table));
    }

    #[Test]
    public function unseatEveryoneAndMoveEveryoneTakeTheWholeTable(): void
    {
        $one = $this->addTable();
        $small = $this->addTable(seats: 2);
        $big = $this->addTable();
        $this->seat($this->guest('Ada Obi', ['Chidi Obi', 'Nneka Obi']), $one);

        $this->as($this->owner, 'POST', $this->plan() . '/guests/move-everyone', ['from' => ['kind' => 'table', 'id' => $one], 'to' => ['kind' => 'table', 'id' => $small]]);
        self::assertSame(409, $this->statusCode());
        self::assertSame([], $this->namesAt($small));

        $this->as($this->owner, 'POST', $this->plan() . '/guests/move-everyone', ['from' => ['kind' => 'table', 'id' => $one], 'to' => ['kind' => 'table', 'id' => $big]]);
        self::assertSame(200, $this->statusCode());
        self::assertSame([[1, 'Ada Obi'], [2, 'Chidi Obi'], [3, 'Nneka Obi']], $this->namesAt($big));
        self::assertSame([], $this->namesAt($one));

        $answer = $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['kind' => 'table', 'placeId' => $big]);
        self::assertSame(200, $this->statusCode());
        self::assertCount(3, Type\vec(Type\mixed())->coerce($answer['moves']));
        self::assertSame(0, $this->planNow()['counts']['seatedGuests']);
    }

    #[Test]
    public function aRowSeatAndASingleSeatTakeGuestsToo(): void
    {
        $row = $this->addRow();
        $single = $this->addSingleSeat();
        $ada = $this->guest('Ada Obi', ['Chidi Obi']);

        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $ada, 'kind' => 'row', 'placeId' => $row, 'seat' => 10]);
        self::assertSame(409, $this->statusCode(), 'a row does not wrap past its last seat');

        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $ada, 'kind' => 'row', 'placeId' => $row, 'seat' => 4]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[4, 'Ada Obi'], [5, 'Chidi Obi']], $this->namesAt($row, 'rows'));

        $bola = $this->guest('Bola Ade');
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $bola, 'kind' => 'seat', 'placeId' => $single]);
        self::assertSame(200, $this->statusCode());
        self::assertSame([[1, 'Bola Ade']], $this->namesAt($single, 'singleSeats'));
    }

    #[Test]
    public function notComingAndRemovalFreeTheChairsOfTheGuestAndTheirParty(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi']);
        $bola = $this->guest('Bola Ade');
        $this->seat($ada, $table);
        $this->seat($bola, $table);
        $published = Iter\count(self::service(RecordingHub::class)->published);

        $this->reply($ada, 'notComing');

        self::assertSame([[3, 'Bola Ade']], $this->namesAt($table));
        self::assertNotContains($ada, Vec\map($this->guestsNow(), static fn (array $guest): mixed => $guest['id']), 'Not coming waits for no seat');
        $topics = Vec\map(Vec\slice(self::service(RecordingHub::class)->published, $published), static fn ($update): array => $update->getTopics());
        self::assertContains(['events/' . $this->eventId . '/seating'], $topics, 'every open plan shows the chairs Empty');

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/guests/' . $bola);
        self::assertSame(204, $this->statusCode());
        self::assertSame([], $this->namesAt($table));
    }

    #[Test]
    public function aGuestsDetailsSayWhereEachCompanionSitsSoRemovingOneCanAskFirst(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi', 'Nneka Obi']);
        $this->seat($ada, $table);
        $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['guestIds' => [$this->companionId('Nneka Obi')]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $details = Type\shape(['guest' => Type\shape(['companions' => Type\vec(Type\shape(['fullName' => Type\nullable(Type\string()), 'seat' => Type\mixed()], true))], true)], true)
            ->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $ada));
        $list = Type\shape(['guests' => Type\vec(Type\shape(['fullName' => Type\nullable(Type\string()), 'companions' => Type\vec(Type\shape(['seat' => Type\mixed()], true))], true))], true)
            ->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests'));
        $listed = Iter\first(Vec\filter($list['guests'], static fn (array $guest): bool => 'Ada Obi' === $guest['fullName'])) ?? self::fail('no Ada');

        self::assertSame([['kind' => 'table', 'name' => 'Table 1'], null], Vec\map($details['guest']['companions'], static fn (array $one): mixed => $one['seat']));
        self::assertSame([['kind' => 'table', 'name' => 'Table 1'], null], Vec\map($listed['companions'], static fn (array $one): mixed => $one['seat']));
    }

    #[Test]
    public function savingAnEditThatRemovedASeatedCompanionFreesTheirChair(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi', ['Chidi Obi', 'Nneka Obi']);
        $this->seat($ada, $table);
        $nneka = Iter\first(Vec\filter($this->guestsNow(), static fn (array $guest): bool => 'Nneka Obi' === $guest['fullName'])) ?? self::fail('no Nneka');

        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $ada);
        $etag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/guests/' . $ada, [
            'fullName' => 'Ada Obi',
            'companions' => [['id' => $this->companionId('Chidi Obi'), 'fullName' => 'Chidi Obi']],
        ], $etag);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[1, 'Ada Obi'], [2, 'Chidi Obi']], $this->namesAt($table));
        self::assertNotContains($nneka['id'], Vec\map($this->guestsNow(), static fn (array $guest): mixed => $guest['id']));
    }

    #[Test]
    public function aTableKeepsTheSeatsItsGuestsSitInAndAnUnusableMarkSkipsATakenChair(): void
    {
        $table = $this->addTable();
        $this->seat($this->guest('Ada Obi'), $table, seat: 2);
        $this->seat($this->guest('Bola Ade'), $table, seat: 9);
        $this->seat($this->guest('Kemi Ade'), $table, seat: 10);

        $this->changeTable($table, ['seats' => 2], 409);
        self::assertSame('3 guests are seated here. Move them first, or keep 3 seats.', $this->last()['detail'] ?? null);
        self::assertSame('seats', $this->last()['field'] ?? null);

        $this->changeTable($table, ['unusableSeats' => [9]], 409);
        self::assertSame('Bola Ade is in this seat. Move them first.', $this->last()['detail'] ?? null);

        $this->changeTable($table, ['seats' => 4]);
        self::assertSame([[2, 'Ada Obi'], [3, 'Bola Ade'], [4, 'Kemi Ade']], $this->namesAt($table), 'chairs the lower count takes away move, side by side, into its first run of free ones');
    }

    #[Test]
    public function aRowKeepsItsLastSeatedGuestAndASingleSeatItsGuest(): void
    {
        $row = $this->addRow();
        $single = $this->addSingleSeat();
        $ada = $this->guest('Ada Obi');
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $ada, 'kind' => 'row', 'placeId' => $row, 'seat' => 7]);
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $this->guest('Bola Ade'), 'kind' => 'seat', 'placeId' => $single]);

        $this->changeItem('rows', $row, ['seats' => 6], 409);
        self::assertSame('Ada Obi is in seat 7. Move them first, or keep 7 seats.', $this->last()['detail'] ?? null);
        $this->changeItem('rows', $row, ['unusableSeats' => [7]], 409);
        self::assertSame('Ada Obi is in this seat. Move them first.', $this->last()['detail'] ?? null);
        $this->changeItem('seats', $single, ['unusable' => true], 409);
        self::assertSame('Bola Ade is in this seat. Move them first.', $this->last()['detail'] ?? null);
        $this->changeItem('rows', $row, ['seats' => 7]);
    }

    #[Test]
    public function deletingATableARowASeatOrThePlanSendsItsGuestsBackToWithoutASeat(): void
    {
        $table = $this->addTable();
        $row = $this->addRow();
        $single = $this->addSingleSeat();
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $kemi = $this->guest('Kemi Ade');
        $this->seat($ada, $table);
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $bola, 'kind' => 'row', 'placeId' => $row]);
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $kemi, 'kind' => 'seat', 'placeId' => $single]);

        $this->as($this->owner, 'DELETE', $this->plan() . '/tables/' . $table, null, '"' . $this->versionOf('tables', $table) . '"');
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->guestNow($ada)['seat']);

        $this->as($this->owner, 'DELETE', $this->plan() . '/rows/' . $row, null, '"' . $this->versionOf('rows', $row) . '"');
        self::assertNull($this->guestNow($bola)['seat']);
        self::assertSame(1, $this->planNow()['counts']['seatedGuests']);

        $this->as($this->owner, 'DELETE', $this->plan());
        self::assertSame(0, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT count(*) FROM seat_assignments WHERE event_id = ?', [$this->eventId])));
        self::assertSame(3, Iter\count(Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests')['guests'] ?? [])), 'the guest list does not change');
    }

    #[Test]
    public function theDatabaseRefusesASecondGuestInAChairAndASecondChairForAGuest(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi');
        $bola = $this->guest('Bola Ade');
        $this->seat($ada, $table, seat: 1);
        $connection = self::em()->getConnection();
        $plan = Type\string()->coerce($connection->fetchOne('SELECT plan_id FROM seating_tables WHERE id = ?', [$table]));

        foreach ([[$bola, 1], [$ada, 2]] as [$who, $seat]) {
            $connection->createSavepoint('second');

            try {
                $connection->insert('seat_assignments', [
                    'id' => Uuid::v7()->toRfc4122(),
                    'event_id' => $this->eventId,
                    'plan_id' => $plan,
                    'guest_id' => $who,
                    'table_id' => $table,
                    'place_id' => $table,
                    'seat' => $seat,
                ]);
                self::fail('a second assignment was saved');
            } catch (UniqueConstraintViolationException) {
                $connection->rollbackSavepoint('second');
            }
        }

        self::assertSame([[1, 'Ada Obi']], $this->namesAt($table));
    }

    #[Test]
    public function withoutSeatingManageNobodyCanBePickedAndAnotherOrganisationsEventIsNotFound(): void
    {
        $table = $this->addTable();
        $ada = $this->guest('Ada Obi');
        $viewer = $this->member('ada@ire.events', SeededRole::Member, EventRole::CanView);

        self::assertSame($this->namesAt($table), [], 'the viewer reads the plan');
        $this->as($viewer, 'GET', $this->plan());
        self::assertSame(200, $this->statusCode());
        $this->as($viewer, 'POST', $this->plan() . '/guests/seat', ['guestId' => $ada, 'kind' => 'table', 'placeId' => $table]);
        self::assertSame(403, $this->statusCode());

        $stranger = $this->account('stranger@else.where');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->as($stranger, 'POST', $this->plan() . '/guests/seat', ['guestId' => $ada, 'kind' => 'table', 'placeId' => $table]);
        self::assertSame(404, $this->statusCode());
        self::assertNull($this->guestNow($ada)['seat']);
    }

    #[Test]
    public function aGuestWhoIsNotComingCannotBeSeatedAndAMaybeCan(): void
    {
        $table = $this->addTable();
        $no = $this->guest('Ada Obi', reply: 'notComing');
        $maybe = $this->guest('Bola Ade', reply: 'maybe');

        $this->seat($no, $table);
        self::assertSame(409, $this->statusCode());
        $this->seat($maybe, $table);
        self::assertSame(200, $this->statusCode());
        self::assertSame('maybe', $this->guestNow($maybe)['reply']);
    }

    /**
     * @param list<?string> $companions
     */
    private function guest(string $name, array $companions = [], ?string $reply = null): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['guest']['id'];

        if (null !== $reply) {
            $this->reply($id, $reply);
        }

        return $id;
    }

    private function reply(string $guest, string $answer): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/record-reply', ['answer' => $answer, 'how' => 'phone', 'replace' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function companionId(string $name): string
    {
        $one = Iter\first(Vec\filter($this->guestsNow(), static fn (array $guest): bool => $name === $guest['fullName'])) ?? self::fail('no ' . $name);

        return Type\string()->coerce($one['id']);
    }

    /** @return array{moves: list<array<string, mixed>>, apart: bool, ...} */
    private function seat(string $guest, string $table, ?int $seat = null, bool $justGuest = false): array
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $guest, 'kind' => 'table', 'placeId' => $table, 'seat' => $seat, 'justGuest' => $justGuest]);

        return 200 === $this->statusCode()
            ? Type\shape(['moves' => Type\vec(Type\dict(Type\string(), Type\mixed())), 'apart' => Type\bool()], true)->coerce($body)
            : ['moves' => [], 'apart' => false];
    }

    private function swap(string $guest, string $with): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/guests/swap', ['guestId' => $guest, 'withGuestId' => $with]);
    }

    /** @param list<array<string, mixed>> $moves */
    private function undo(array $moves): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/guests/undo', ['moves' => $moves]);
    }

    private function addTable(int $seats = 10): string
    {
        $body = $this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round']);
        $id = Type\string()->coerce($body['tableId'] ?? null);

        if (10 !== $seats) {
            $this->changeTable($id, ['seats' => $seats]);
        }

        return $id;
    }

    private function addRow(): string
    {
        return Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/rows')['rowId'] ?? null);
    }

    private function addSingleSeat(): string
    {
        return Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/seats')['seatId'] ?? null);
    }

    /** @param array<string, mixed> $fields */
    private function changeTable(string $table, array $fields, int $expected = 200): void
    {
        $this->changeItem('tables', $table, $fields, $expected);
    }

    /** @param array<string, mixed> $fields */
    private function changeItem(string $kind, string $id, array $fields, int $expected = 200): void
    {
        $this->as($this->owner, 'PATCH', $this->plan() . '/' . $kind . '/' . $id, $fields, '"' . $this->versionOf($kind, $id) . '"');
        self::assertSame($expected, $this->statusCode(), Json\encode($this->last()));
    }

    private function versionOf(string $kind, string $id): int
    {
        return Type\int()->coerce($this->itemNow('seats' === $kind ? 'singleSeats' : $kind, $id)['version']);
    }

    /** @return array<string, mixed> */
    private function itemNow(string $list, string $id): array
    {
        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planNow()[$list]) as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        self::fail('no ' . $id . ' in ' . $list);
    }

    /** @return list<array{0: int, 1: string}> */
    private function seatedAt(string $id, string $list = 'tables'): array
    {
        $seated = Type\vec(Type\shape(['seat' => Type\int(), 'guestId' => Type\string()]))->coerce($this->itemNow($list, $id)['seated']);

        return Vec\map($seated, static fn (array $one): array => [$one['seat'], $one['guestId']]);
    }

    /** @return list<array{0: int, 1: string}> each seat number with its guest's name */
    private function namesAt(string $id, string $list = 'tables'): array
    {
        $names = Dict\pull($this->guestsNow(), static fn (array $guest): string => Type\string()->coerce($guest['fullName'] ?? '?'), static fn (array $guest): string => Type\string()->coerce($guest['id']));

        return Vec\map($this->seatedAt($id, $list), static fn (array $one): array => [$one[0], $names[$one[1]] ?? '?']);
    }

    /** @return array<string, mixed> */
    private function guestNow(string $id): array
    {
        foreach ($this->guestsNow() as $guest) {
            if ($guest['id'] === $id) {
                return $guest;
            }
        }

        self::fail('no guest ' . $id);
    }

    /** @return list<array<string, mixed>> */
    private function guestsNow(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planNow()['guests']);
    }

    /** @return array{counts: array<string, int>, guests: mixed, tables: mixed, rows: mixed, singleSeats: mixed, ...} */
    private function planNow(): array
    {
        $body = $this->as($this->owner, 'GET', $this->plan());
        $seating = Type\dict(Type\string(), Type\mixed())->coerce($body['seating'] ?? null);

        return Type\shape([
            'counts' => Type\dict(Type\string(), Type\int()),
            'guests' => Type\mixed(),
            'tables' => Type\mixed(),
            'rows' => Type\mixed(),
            'singleSeats' => Type\mixed(),
        ], true)->coerce($seating['plan'] ?? null);
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2030-06-12T16:00',
            'endsAt' => '2030-06-13T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode());
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($by, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
