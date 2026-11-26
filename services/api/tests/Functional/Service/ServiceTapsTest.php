<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\StaffRoster;
use App\Entity\Event;
use App\Entity\SeatingSection;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\StationKind;
use App\Locale\NameNormaliser;
use App\Repository\EmailAddressRepository;
use DateTimeImmutable;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;
use Symfony\Component\Uid\Uuid;

/** sc-4028: every service write carries a key and what its tap saw; a key sent again changes nothing, and a step that no longer fits is refused with a name. */
final class ServiceTapsTest extends ServiceTestCase
{
    private const string LEAD = 'Ifeoma Nduka';

    #[Test]
    public function aWriteWithNoKeyOrNothingExpectedIsRefusedWith400AndChangesNothing(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $path = $this->path('/trays/' . self::id($tray) . '/marks');
        $body = ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'on'];

        $this->raw('PUT', $path, [...$body, 'expected' => ['plates' => [$plate => 'dishing']]]);
        $this->assertRefused(400, ErrorCode::IdempotencyKeyRequired->type());

        $this->raw('PUT', $path, $body, self::key());
        $this->assertRefused(400, ErrorCode::ExpectedRequired->type());

        $this->raw('POST', $this->path('/trays/' . self::id($tray) . '/check'), ['expected' => null], self::key());
        $this->assertRefused(400, ErrorCode::ExpectedRequired->type());

        self::assertSame([], Vec\filter_nulls(Vec\map(self::marksOf(self::trayOf($this->read(), self::id($tray))), static fn (array $one): mixed => $one['mark'] ?? null)), 'nothing was marked');
    }

    #[Test]
    public function aKeySentAgainGetsTheFirstAnswerAndChangesNothingAndOnAnotherRequestIs422(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $this->markAll($tray, 'on');
        $key = self::key();
        $check = $this->path('/trays/' . self::id($tray) . '/check');
        $saw = ['expected' => ['plates' => [$plate => 'dishing']]];

        $first = $this->raw('POST', $check, $saw, $key);
        self::assertSame(200, $this->statusCode(), Json\encode($first));
        $this->as('POST', '/api/events/' . $this->event->getId()->toRfc4122() . '/service/trays/' . self::id($tray) . '/take-to-table');
        self::assertSame('onItsWay', $this->orderOf('Adaeze Obi')['stage']);

        $again = $this->raw('POST', $check, $saw, $key);
        self::assertSame(200, $this->statusCode());
        self::assertSame($first, $again, 'the first answer, as it was');
        self::assertSame('onItsWay', $this->orderOf('Adaeze Obi')['stage'], 'and nothing changed');

        $this->raw('POST', $check, ['expected' => ['plates' => [$plate => 'checked']]], $key);
        $this->assertRefused(422, ErrorCode::IdempotencyKeyReused->type());
    }

    #[Test]
    public function keysOlderThanTwentyFourHoursAreDeletedEveryHourAndTheRestKept(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $this->mark($tray, $plate, 'plantain', 'on');
        self::em()->getConnection()->executeStatement("UPDATE service_taps SET made_at = NOW() - INTERVAL '25 hours'");
        $this->mark($tray, $plate, 'plantain', 'notOn');

        $tester = new CommandTester(new Application(self::$kernel ?? throw new LogicException('No kernel.'))->find('app:service-taps:expire'));
        $tester->execute(['--dry-run' => true]);
        self::assertStringContainsString('Would delete 1 service tap keys.', $tester->getDisplay());
        $tester->execute([]);
        $tester->assertCommandIsSuccessful();

        self::assertSame([true], self::em()->getConnection()->fetchFirstColumn("SELECT made_at > NOW() - INTERVAL '1 hour' FROM service_taps"), 'the 25-hour-old key is gone, the fresh one kept');
    }

    #[Test]
    public function aRefusalIsTheFirstAnswerToItsKeyToo(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $key = self::key();
        $tick = $this->path('/trays/' . self::id($tray) . '/plates/' . $plate . '/served');

        $this->raw('POST', $tick, ['expected' => ['plates' => [$plate => 'onItsWay']]], $key);
        $this->assertRefused(409, ErrorCode::ServiceChanged->type());
        $this->toTheTable($tray);

        $this->raw('POST', $tick, ['expected' => ['plates' => [$plate => 'onItsWay']]], $key);
        $this->assertRefused(409, ErrorCode::ServiceChanged->type());
        self::assertSame('onItsWay', $this->orderOf('Adaeze Obi')['stage'], 'the second send changed nothing');
    }

    #[Test]
    public function aTickWhosePlateWasSentBackIsRefusedWithItsStageNowAndWhoMovedIt(): void
    {
        $tray = $this->trayAtDishing();
        $this->toTheTable($tray);
        $plate = Type\string()->coerce($tray['plates'][0]);
        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'wrongDish']);

        $this->post('/trays/' . self::id($tray) . '/plates/' . $plate . '/served', ['expected' => ['plates' => [$plate => 'onItsWay']]]);

        $this->assertRefused(409, ErrorCode::ServiceChanged->type());
        self::assertSame([['plateId' => $plate, 'guestId' => $this->guests['Adaeze Obi']->getId()->toRfc4122(), 'table' => $this->tableKey(), 'stage' => 'toServe', 'onTray' => false, 'by' => self::LEAD]], $this->last()['changed']);
        self::assertSame('toServe', $this->orderOf('Adaeze Obi')['stage']);
    }

    #[Test]
    public function aKeptCheckAfterThePlateWasTakenOffIsRefusedNamingThePlateOffTheTray(): void
    {
        $tray = $this->trayAtDishing('Adaeze Obi', 'Bola Ade');
        $this->markAll($tray, 'on');
        [$adaeze, $bola] = Type\vec(Type\string())->coerce($tray['plates']);
        $saw = ['plates' => [$adaeze => 'dishing', $bola => 'dishing']];
        $this->takeOff(self::id($tray), $adaeze);

        $this->post('/trays/' . self::id($tray) . '/check', ['expected' => $saw]);

        $this->assertRefused(409, ErrorCode::ServiceChanged->type());
        $changed = Type\vec(Type\mixed_dict())->coerce($this->last()['changed']);
        self::assertSame([[$adaeze, 'toServe', false, self::LEAD]], Vec\map($changed, static fn (array $one): array => [$one['plateId'], $one['stage'], $one['onTray'], $one['by']]));
        self::assertSame('dishing', $this->orderOf('Bola Ade')['stage'], 'the check was not made, though the plate left on it could take it');
    }

    #[Test]
    public function aKeptTakeToTheTableAfterTheCheckWasUndoneIsRefused(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $this->markAll($tray, 'on');
        $this->post('/trays/' . self::id($tray) . '/check');
        $this->post('/undo', ['subject' => self::id($tray)]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));

        $this->post('/trays/' . self::id($tray) . '/take-to-table', ['expected' => ['plates' => [$plate => 'checked']]]);

        $this->assertRefused(409, ErrorCode::ServiceChanged->type());
        self::assertSame([[$plate, 'dishing', true]], Vec\map(Type\vec(Type\mixed_dict())->coerce($this->last()['changed']), static fn (array $one): array => [$one['plateId'], $one['stage'], $one['onTray']]));
    }

    #[Test]
    public function aStationsPreparingAfterAnotherDishersIsRefusedWithTheItemsStateAndTheirName(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $this->itemState('plantain', 'preparing', 10);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->put('/course/' . $this->courseId() . '/items', ['item' => 'plantain', 'state' => 'preparing', 'readyIn' => 5, 'expected' => ['item' => 'ready']]);

        $this->assertRefused(409, ErrorCode::ServiceChanged->type());
        self::assertSame([['item' => 'plantain', 'state' => 'preparing', 'by' => self::LEAD]], $this->last()['changed']);
    }

    #[Test]
    public function aKeptTapOnATrayThatIsSomebodyElsesIsTrayNotYoursNamingThem(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $this->caller = $this->waiterOnTheSection();

        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'on', 'expected' => ['plates' => [$plate => 'dishing']]]);

        $this->assertRefused(403, ErrorCode::TrayNotYours->type());
        self::assertSame(self::LEAD, Type\mixed_dict()->coerce($this->last()['waiter'])['name']);
    }

    #[Test]
    public function aKeptUndoLandingAfterTwoMinutesIsTooLate(): void
    {
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $this->mark($tray, $plate, 'plantain', 'on');
        self::mockTime(new DateTimeImmutable('2027-03-06T19:02:01Z'));

        $this->post('/undo', ['subject' => $plate, 'expected' => ['plates' => [$plate => 'dishing']]]);

        $this->assertRefused(409, ErrorCode::UndoExpired->type());
    }

    #[Test]
    public function tooManyTapsAreRefusedWith429AndRetryAfter(): void
    {
        $limiter = new RateLimiterFactory(['id' => 'service_tap', 'policy' => 'token_bucket', 'limit' => 60, 'rate' => ['interval' => '30 seconds', 'amount' => 60]], new InMemoryStorage());
        self::getContainer()->set('limiter.service_tap', $limiter);
        $tray = $this->trayAtDishing();
        $plate = Type\string()->coerce($tray['plates'][0]);
        $limiter->create($this->owner->getId()->toRfc4122())->consume(60);

        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $plate, 'item' => 'plantain', 'mark' => 'on']);

        $this->assertRefused(429, ErrorCode::TooManyAttempts->type());
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));
    }

    /** @return array<array-key, mixed> */
    private function trayAtDishing(string ...$names): array
    {
        $names = [] === $names ? ['Adaeze Obi'] : $names;
        $this->arrive(...$names);
        $this->fire();

        return $this->startTray();
    }

    /** @param array<array-key, mixed> $tray */
    private function mark(array $tray, string $plateId, string $item, string $mark): void
    {
        $this->put('/trays/' . self::id($tray) . '/marks', ['plateId' => $plateId, 'item' => $item, 'mark' => $mark]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function waiterOnTheSection(): User
    {
        $bisi = $this->account('bisi@lagoslights.example', 'Bisi Waiter');

        foreach (self::service(EmailAddressRepository::class)->findBy(['user' => $bisi]) as $email) {
            $email->setVerifiedAt(new DateTimeImmutable('2027-03-01T00:00:00Z'));
        }

        $event = self::em()->find(Event::class, $this->event->getId()) ?? self::fail('no event');
        $section = self::em()->find(SeatingSection::class, $this->section->getId()) ?? self::fail('no section');
        $owner = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        $station = new StaffStation($event, StationKind::Section, $section->getName(), NameNormaliser::key($section->getName()), $section, 0);
        self::em()->persist($station);
        self::service(StaffRoster::class)->add($event, new StaffDetails($bisi->getName(), null, 'bisi@lagoslights.example'), null, null, $owner, allowShared: true)->setStation($station);
        self::em()->flush();
        $this->as('POST', '/api/events/' . $this->event->getId()->toRfc4122() . '/people', ['address' => 'bisi@lagoslights.example', 'role' => 'can_work_floor']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return $bisi;
    }

    private function path(string $path): string
    {
        return '/api/events/' . $this->event->getId()->toRfc4122() . '/service' . $path;
    }

    /** @return array{HTTP_IDEMPOTENCY_KEY: string} */
    private static function key(): array
    {
        return ['HTTP_IDEMPOTENCY_KEY' => Uuid::v4()->toRfc4122()];
    }

    /** @param array<array-key, mixed> $tray */
    private static function id(array $tray): string
    {
        return Type\string()->coerce($tray['id']);
    }
}
