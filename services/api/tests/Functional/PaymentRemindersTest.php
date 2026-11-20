<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Budget\Reminder\PaymentReminder;
use App\Domain\Budget\Reminder\PaymentReminders;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\NotificationWorker;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\CataloguePart;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationChannel;
use App\Enum\SeededRole;
use App\Repository\CatalogueVersionRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class PaymentRemindersTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $quoteId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@bloom.events', 'Harriet Cole');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Bloom Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $vendor = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/vendors', ['name' => 'Bloom & Co', 'category' => 'flowers']);
        self::assertSame(201, $this->statusCode(), Json\encode($vendor));
        $quote = $this->as($this->owner, 'POST', $this->quotes(), [
            'vendorId' => Type\shape(['id' => Type\string()], true)->coerce($vendor['vendor'] ?? null)['id'],
            'covers' => 'Bouquets',
            'amount' => '1000',
            'currency' => 'GBP',
            'quotedOn' => '2027-02-20',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($quote));
        $this->quoteId = Type\shape(['id' => Type\string()], true)->coerce($quote['quote'] ?? null)['id'];
    }

    #[Test]
    public function anOwedPaymentHasTwoRemindersCountedOnTheEventsClock(): void
    {
        $payment = $this->payment('Deposit', '2027-03-10');

        self::assertSame([
            PaymentReminders::COMING_DUE => '2027-03-07 09:00:00',
            PaymentReminders::OVERDUE => '2027-03-11 09:00:00',
        ], $this->pending($payment));
    }

    #[Test]
    public function aPaymentAlreadyPastDueWhenItBecomesOwedHasOnlyTheOverdueOne(): void
    {
        $payment = $this->payment('Balance', '2027-02-27');

        self::assertSame([PaymentReminders::OVERDUE => '2027-02-28 09:00:00'], $this->pending($payment));
    }

    #[Test]
    public function markingPaidOrCancellingRemovesBothAndUnmarkingOrRestoringWritesThemAgain(): void
    {
        $payment = $this->payment('Deposit', '2027-03-10');

        $this->as($this->owner, 'POST', $this->payments($payment) . '/paid', ['amount' => '400', 'currency' => 'GBP', 'paidOn' => '2027-03-01']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([], $this->pending($payment));

        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/paid');
        self::assertCount(2, $this->pending($payment));

        $this->as($this->owner, 'POST', $this->payments($payment) . '/cancellation', ['reason' => 'Moved to another florist']);
        self::assertSame([], $this->pending($payment));

        $this->as($this->owner, 'DELETE', $this->payments($payment) . '/cancellation');
        self::assertCount(2, $this->pending($payment));
    }

    #[Test]
    public function theSettingStartsAtThreeAndAChangeMovesWhatHasNotGone(): void
    {
        $payment = $this->payment('Deposit', '2027-03-10');

        self::assertSame(['days' => 3, 'inForce' => true], $this->as($this->owner, 'GET', $this->setting()));

        self::assertSame(['days' => 5, 'inForce' => true], $this->as($this->owner, 'PUT', $this->setting(), ['days' => 5]));
        self::assertSame('2027-03-05 09:00:00', $this->pending($payment)[PaymentReminders::COMING_DUE] ?? null);
    }

    #[Test]
    #[DataProvider('refusedDays')]
    public function daysOutsideOneToThirtyAreRefusedNamingTheRange(mixed $days): void
    {
        $this->as($this->owner, 'PUT', $this->setting(), ['days' => $days]);

        self::assertSame(422, $this->statusCode());
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);
        self::assertSame([['days', 'Enter a whole number of days from 1 to 30.']], Vec\map($violations, static fn (array $one): array => [$one['propertyPath'], $one['message']]));
        self::assertSame(3, $this->as($this->owner, 'GET', $this->setting())['days'] ?? null);
    }

    /** @return iterable<string, array{mixed}> */
    public static function refusedDays(): iterable
    {
        yield 'none' => [0];
        yield 'past thirty' => [31];
        yield 'a fraction' => [2.5];
        yield 'words' => ['three'];
        yield 'blank' => [null];
    }

    #[Test]
    public function onlyOwnersAndAdminsSeeOrChangeTheSetting(): void
    {
        $admin = $this->member('admin@bloom.events', 'Ade Admin', SeededRole::Admin, null);
        $lead = $this->member('lead@bloom.events', 'Lola Lead', SeededRole::Member, EventRole::Lead);

        $this->as($admin, 'PUT', $this->setting(), ['days' => 7]);
        self::assertSame(200, $this->statusCode());

        $this->as($lead, 'GET', $this->setting());
        self::assertSame(403, $this->statusCode());
        $this->as($lead, 'PUT', $this->setting(), ['days' => 2]);
        self::assertSame(403, $this->statusCode());
        self::assertSame(7, $this->as($this->owner, 'GET', $this->setting())['days'] ?? null);
    }

    #[Test]
    public function oneMessageGoesToWhoeverCanMarkItPaidAndNeverAgain(): void
    {
        $lead = $this->member('lead@bloom.events', 'Lola Lead', SeededRole::Member, EventRole::Lead);
        $editor = $this->member('edit@bloom.events', 'Ed Edit', SeededRole::Member, EventRole::CanEdit);
        $this->member('off@bloom.events', 'Olu Off', SeededRole::Member, null);
        $deposit = $this->payment('Deposit', '2027-03-10');
        $balance = $this->payment('Balance', '2027-03-05');

        self::mockTime(new DateTimeImmutable('2027-03-07T10:00:00Z'));
        self::runUntilIdle();

        $messages = $this->inApp();
        self::assertEqualsCanonicalizing([$this->owner->getId()->toRfc4122(), $lead->getId()->toRfc4122()], Vec\keys($messages));
        self::assertNotContains($editor->getId()->toRfc4122(), Vec\keys($messages));
        self::assertSame(['1 payment overdue, 1 due in the next 3 days'], $messages[$lead->getId()->toRfc4122()]);

        $this->as($this->owner, 'POST', $this->payments($deposit) . '/paid', ['amount' => '400', 'currency' => 'GBP', 'paidOn' => '2027-03-07']);
        $this->as($this->owner, 'DELETE', $this->payments($deposit) . '/paid');
        self::assertSame([PaymentReminders::OVERDUE => '2027-03-11 09:00:00'], $this->pending($deposit));
        self::assertSame([], $this->pending($balance));
    }

    #[Test]
    public function theMessageNamesVendorAmountAndDateWithTheOverdueOneFirstAndLast(): void
    {
        $deposit = $this->payment('Deposit', '2027-03-10');
        $balance = $this->payment('Balance', '2027-03-05');
        self::mockTime(new DateTimeImmutable('2027-03-07T10:00:00Z'));

        $rendered = self::service(PaymentReminder::class)->render(
            NotificationChannel::InApp,
            new Recipient(NotificationAudienceKind::Member, $this->owner->getId(), 'Harriet Cole', 'en', null),
            [
                ['paymentId' => $deposit, 'kind' => PaymentReminders::COMING_DUE],
                ['paymentId' => $balance, 'kind' => PaymentReminders::OVERDUE],
            ],
        );

        self::assertSame('1 payment overdue, 1 due in the next 3 days', $rendered->subject);
        self::assertSame([
            'Bloom & Co · £1,000.00 · was due Fri, 5 Mar · Overdue · last reminder',
            'Bloom & Co · £1,000.00 · due Wed, 10 Mar',
            'This is the last reminder about the balance to Bloom & Co.',
        ], $rendered->lines);
        self::assertStringStartsWith('/app/events/' . $this->eventId . '/budget/vendors/', $rendered->place ?? '');
    }

    #[Test]
    public function afterADowngradeNothingGoesAndTheSettingSaysSo(): void
    {
        $this->payment('Deposit', '2027-03-10');
        $first = self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::Plans, '2026-10-19') ?? self::fail('no catalogue');
        $terms = Type\dict(Type\string(), Type\dict(Type\string(), Type\mixed()))->coerce($first->getTerms());
        $terms['free']['features'] = Vec\values(Vec\filter(Type\vec(Type\string())->coerce($terms['free']['features']), static fn (string $feature): bool => 'vendors' !== $feature));
        $keeper = self::service(CatalogueKeeper::class);
        $keeper->moveSubscribers($keeper->publish(CataloguePart::Plans, '2027-03-01', $terms, 'Vendors off Free, for a test', 'Ada at Soirely'), null, 'A downgrade, for a test', 'Ada at Soirely');
        self::em()->clear();

        self::assertSame(['days' => 3, 'inForce' => false], $this->as($this->owner, 'GET', $this->setting()));

        self::mockTime(new DateTimeImmutable('2027-03-07T10:00:00Z'));
        self::runUntilIdle();
        self::assertSame([], $this->inApp());
    }

    private static function runUntilIdle(): void
    {
        $worker = self::service(NotificationWorker::class);
        $steps = 0;

        while ($steps < 100 && $worker->step()) {
            ++$steps;
        }
    }

    /** @return array<string, list<string>> each member's in-app titles about payments, by user id */
    private function inApp(): array
    {
        $rows = self::em()->getConnection()->fetchAllAssociative(
            "SELECT user_id, title FROM notification_items WHERE category = 'money' ORDER BY created_at, id",
        );
        $by = [];

        foreach ($rows as $row) {
            $by[Type\string()->coerce($row['user_id'])][] = Type\string()->coerce($row['title']);
        }

        return $by;
    }

    /** @return array<string, string> each pending reminder's day and time, by kind, in UTC */
    private function pending(string $paymentId): array
    {
        $pending = [];

        foreach ([PaymentReminders::COMING_DUE, PaymentReminders::OVERDUE] as $kind) {
            $due = self::em()->getConnection()->fetchOne(
                "SELECT to_char(due_at, 'YYYY-MM-DD HH24:MI:SS') FROM scheduled_notifications WHERE cancellation_key = :key AND status = 'pending'",
                ['key' => PaymentReminders::key(Uuid::fromString($paymentId), $kind)],
            );

            if (false !== $due) {
                $pending[$kind] = Type\string()->coerce($due);
            }
        }

        return $pending;
    }

    private function payment(string $description, string $dueOn): string
    {
        $answer = $this->as($this->owner, 'POST', $this->quotes() . '/' . $this->quoteId . '/payments', ['description' => $description, 'amount' => '1000', 'currency' => 'GBP', 'dueOn' => $dueOn]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $payments = Type\vec(Type\shape(['id' => Type\string(), 'description' => Type\string()], true))->coerce(Type\shape(['payments' => Type\mixed()], true)->coerce($answer['quote'] ?? null)['payments']);

        return Vec\filter($payments, static fn (array $one): bool => $description === $one['description'])[0]['id'] ?? self::fail('no payment');
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Summer wedding',
            'type' => 'wedding',
            'startsAt' => '2027-06-12T14:00',
            'endsAt' => '2027-06-13T01:00',
            'timeZone' => 'Europe/London',
            'currency' => 'GBP',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function setting(): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/payment-reminders';
    }

    private function quotes(): string
    {
        return '/api/events/' . $this->eventId . '/budget/quotes';
    }

    private function payments(string $id): string
    {
        return '/api/events/' . $this->eventId . '/budget/payments/' . $id;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
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
