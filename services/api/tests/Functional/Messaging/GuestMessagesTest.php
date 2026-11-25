<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Channel\EmailSender;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Messaging\NotificationWorker;
use App\Domain\Messaging\Webhook\MailWebhook;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Guest;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\NotificationAudienceKind;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingEmailSender;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\RawMessage;
use Symfony\Contracts\Translation\TranslatorInterface;

final class GuestMessagesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
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
        self::mockTime(new DateTimeImmutable('2026-11-21T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function sendQueuesAnEmailForEachGuestWithAnAddressAndRecordsTheRestNotSent(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test', ['Ada Nwosu']);
        $this->add('Kemi Bello', null);

        $sent = $this->send(['audience' => 'all', 'message' => 'Dinner starts at seven.']);

        self::assertSame(202, $this->statusCode(), Json\encode($sent));
        self::assertSame(['email' => 1], $sent['queued']);
        self::assertSame(['email' => 1], $sent['notSent']);
        self::assertSame([['Emeka Nwosu', 'queued', null], ['Kemi Bello', 'not_sent', 'no_address']], $this->states(Type\string()->coerce($sent['id'])));
    }

    #[Test]
    public function theCheckCountsWhatSendQueues(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $this->add('Kemi Bello', null);

        $check = $this->as($this->owner, 'POST', $this->messages() . '/check', ['audience' => 'all']);

        self::assertSame(200, $this->statusCode(), Json\encode($check));
        self::assertSame(2, $check['people']);
        self::assertSame(1, $check['toldByEmail']);
        self::assertSame([['name' => 'Kemi Bello', 'reason' => 'no_address']], Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($check['cantBeTold']), static fn (array $row): array => ['name' => $row['name'], 'reason' => $row['reason']]));
        self::assertSame(['email' => 1], $this->send(['audience' => 'all', 'message' => 'Hello'])['queued']);
    }

    #[Test]
    public function theEmailIsSoirelysNoticeWithTheGuestsLinkAndNeverTheirWords(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $this->send(['audience' => 'all', 'subject' => 'Secret plans', 'message' => 'The cake is a surprise.']);
        $this->work();

        $sent = $this->toGuests();
        self::assertCount(1, $sent);
        $notice = $sent[0]['notification'];
        self::assertSame('emeka@example.test', $sent[0]['recipient']->emailAddress);
        self::assertStringContainsString('/i/', $notice->body);
        self::assertSame('Ìrè Events via Soirely', $notice->senderName);
        self::assertStringNotContainsString('Secret plans', $notice->subject . $notice->body);
        self::assertStringNotContainsString('cake', $notice->subject . $notice->body);
    }

    #[Test]
    public function theEmailGoesToTheAddressFixedWhenTheMessageWentAndItsRowKeepsIt(): void
    {
        $guest = $this->add('Emeka Nwosu', 'emeka@example.test');
        $id = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Hello'])['id']);
        $this->changeEmail($guest, 'new@example.test');
        $this->work();

        self::assertSame('emeka@example.test', $this->toGuests()[0]['recipient']->emailAddress);
        self::assertSame('emeka@example.test', $this->deliveries($id)[0]['address']);
    }

    #[Test]
    public function chosenGuestsAreTheOnlyOnesItGoesTo(): void
    {
        $emeka = $this->add('Emeka Nwosu', 'emeka@example.test');
        $this->add('Kemi Bello', 'kemi@example.test');

        $sent = $this->send(['audience' => 'chosen', 'guestIds' => [$emeka], 'message' => 'Just you']);

        self::assertSame([['Emeka Nwosu', 'queued', null]], $this->states(Type\string()->coerce($sent['id'])));
    }

    /** @return iterable<string, array{array<string, mixed>, list<string>}> */
    public static function refusals(): iterable
    {
        yield 'a blank message' => [['audience' => 'all', 'message' => "   \n "], ['message']];
        yield 'a subject of 151' => [['audience' => 'all', 'subject' => Str\repeat('s', 151), 'message' => 'Hi'], ['subject']];
        yield 'a message of 10,001' => [['audience' => 'all', 'message' => Str\repeat('m', 10001)], ['message']];
        yield 'nobody chosen' => [['audience' => 'chosen', 'guestIds' => [], 'message' => 'Hi'], ['guestIds']];
        yield 'every field at once, in the form\'s order' => [['audience' => 'chosen', 'guestIds' => [], 'subject' => Str\repeat('s', 151), 'message' => ''], ['guestIds', 'subject', 'message']];
    }

    /**
     * @param array<string, mixed> $body
     * @param list<string>         $fields
     */
    #[Test]
    #[DataProvider('refusals')]
    public function aSendThatCannotGoIsRefusedOnEachFailingField(array $body, array $fields): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');

        $refusal = $this->send($body);

        self::assertSame(422, $this->statusCode(), Json\encode($refusal));
        self::assertSame($fields, $this->paths($refusal['violations'] ?? []));
        self::assertSame(0, $this->messageCount());
    }

    #[Test]
    public function theLimitsThemselvesSendWithTheEndsTrimmed(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');

        $this->send(['audience' => 'all', 'subject' => ' ' . Str\repeat('s', 150) . ' ', 'message' => Str\repeat('m', 10000) . "\n"]);

        self::assertSame(202, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function theLimitSentenceIsWrittenForTheLanguage(): void
    {
        $refusal = $this->send(['audience' => 'all', 'message' => Str\repeat('m', 10001)]);

        $expected = self::service(TranslatorInterface::class)->trans('validation.guest_message_too_long', ['count' => 10000], null, 'en');
        self::assertSame($expected, Type\string()->coerce(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($refusal['violations'] ?? [])[0]['message'] ?? null));
        self::assertStringContainsString('10,000', $expected);
    }

    #[Test]
    public function allGuestsOnAnEventWithNoneIsRefused(): void
    {
        $refusal = $this->send(['audience' => 'all', 'message' => 'Anyone?']);

        self::assertSame(422, $this->statusCode());
        self::assertSame(['audience'], $this->paths($refusal['violations'] ?? []));
    }

    #[Test]
    public function aMessageNoEmailCanAnnounceStillGoesOnTheirPages(): void
    {
        $this->add('Kemi Bello', null);

        $sent = $this->send(['audience' => 'all', 'message' => 'Hello']);

        self::assertSame(202, $this->statusCode());
        self::assertSame(['email' => 0], $sent['queued']);
        self::assertSame(1, $this->messageCount());
    }

    #[Test]
    public function aMessageWithNoSubjectIsSavedWithNone(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $this->send(['audience' => 'all', 'subject' => '   ', 'message' => "\nSee you soon\nLove"]);

        $listed = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->messages())['messages']);
        self::assertNull($listed[0]['subject']);
        self::assertSame('See you soon', $listed[0]['firstLine']);
    }

    #[Test]
    public function allMessagesCountsWhoItReached(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $this->add('Kemi Bello', null);
        $this->send(['audience' => 'all', 'message' => 'Hello']);
        $this->work();

        $listed = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->messages())['messages']);
        self::assertSame([1, 2, false], [$listed[0]['reached'], $listed[0]['deliveries'], $listed[0]['sending']]);
    }

    #[Test]
    public function anAddressAComplaintStoppedIsSkippedOnTheOrganisationsNextSend(): void
    {
        $this->add('Emeka Nwosu', 'Emeka@example.test');
        $first = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'One'])['id']);
        $this->work();
        self::service(Connection::class)->executeStatement("UPDATE notification_deliveries SET provider_report = 'complained' WHERE source_id = :id", ['id' => $first]);

        $second = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Two'])['id']);

        self::assertSame([['Emeka Nwosu', 'reported_as_spam', null]], $this->states($first));
        self::assertSame([['Emeka Nwosu', 'not_sent', 'complained']], $this->states($second));
    }

    #[Test]
    public function aBouncingAddressIsSkippedUntilItIsChanged(): void
    {
        $guest = $this->add('Emeka Nwosu', 'emeka@example.test');
        self::service(Connection::class)->executeStatement('UPDATE guests SET email_bouncing_at = NOW() WHERE id = :id', ['id' => $guest]);
        $skipped = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'One'])['id']);
        self::assertSame([['Emeka Nwosu', 'not_sent', 'bouncing']], $this->states($skipped));

        $this->changeEmail($guest, 'fixed@example.test');
        $sent = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Two'])['id']);

        self::assertSame([['Emeka Nwosu', 'queued', null]], $this->states($sent));
    }

    #[Test]
    public function aHardBounceMarksTheGuestBouncingWithItsCodeAndTheNextSendSkipsThem(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $first = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'One'])['id']);
        $this->work();

        self::service(MailWebhook::class)->receive(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'emeka@example.test', 'Details' => 'smtp;550 5.1.1 The email account that you tried to reach does not exist', 'Metadata' => ['delivery' => $this->deliveryOf($first)]]);
        $second = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Two'])['id']);

        self::assertSame([['Emeka Nwosu', 'bounced', null]], $this->states($first));
        self::assertSame('5.1.1', $this->deliveries($first)[0]['code']);
        self::assertSame([['Emeka Nwosu', 'not_sent', 'bouncing']], $this->states($second));
    }

    #[Test]
    public function aBounceAfterTheAddressChangedLeavesTheNewAddressAlone(): void
    {
        $guest = $this->add('Emeka Nwosu', 'emeka@example.test');
        $first = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'One'])['id']);
        $this->work();
        $this->changeEmail($guest, 'fixed@example.test');

        self::service(MailWebhook::class)->receive(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => 'emeka@example.test', 'Metadata' => ['delivery' => $this->deliveryOf($first)]]);
        $second = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Two'])['id']);

        self::assertSame([['Emeka Nwosu', 'bounced', null]], $this->states($first));
        self::assertSame('emeka@example.test', $this->deliveries($first)[0]['address']);
        self::assertSame([['Emeka Nwosu', 'queued', null]], $this->states($second));
    }

    #[Test]
    public function anAddressTheProviderBlocksIsNotSentAtOnceAndTriedOnTheNextSend(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $sender = self::service(RecordingEmailSender::class);
        $sender->through = new EmailSender(new class implements MailerInterface {
            public function send(RawMessage $message, ?Envelope $envelope = null): void
            {
                throw new TransportException('Expected response code "250" but got code "406", with message "406 You tried to send to a recipient that has been marked as inactive."', 406);
            }
        }, 'notices@soirely.test');
        $first = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'One'])['id']);
        $this->work();
        $sender->through = null;

        $second = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Two'])['id']);

        self::assertSame([['Emeka Nwosu', 'not_sent', 'provider_blocked']], $this->states($first));
        self::assertNull($this->deliveries($first)[0]['code']);
        self::assertSame([['Emeka Nwosu', 'queued', null]], $this->states($second));
        self::assertNull(self::service(Connection::class)->fetchOne('SELECT email_bouncing_at FROM guests'));
    }

    #[Test]
    public function anAddressTheProviderReportsBlockedIsNotSentAndNeverBounced(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $first = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'One'])['id']);
        $this->work();

        self::service(MailWebhook::class)->receive(['RecordType' => 'Bounce', 'Type' => 'ManuallyDeactivated', 'Email' => 'emeka@example.test', 'Details' => 'smtp;550 5.1.1 inactive', 'Metadata' => ['delivery' => $this->deliveryOf($first)]]);
        $second = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Two'])['id']);

        self::assertSame([['Emeka Nwosu', 'not_sent', 'provider_blocked']], $this->states($first));
        self::assertNull($this->deliveries($first)[0]['code']);
        self::assertSame([['Emeka Nwosu', 'queued', null]], $this->states($second));
    }

    #[Test]
    public function anErasedGuestsDeliveriesLoseTheirAddress(): void
    {
        $guest = $this->add('Emeka Nwosu', 'emeka@example.test', ['Ada Nwosu']);
        $this->send(['audience' => 'all', 'message' => 'One']);

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/guests/' . $guest);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/erasure');

        self::assertSame(204, $this->statusCode());
        self::assertSame(0, (int) self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM notification_deliveries WHERE address IS NOT NULL'));
        self::assertGreaterThan(0, (int) self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM notification_deliveries'));
    }

    #[Test]
    public function aDraftCannotSend(): void
    {
        $draft = $this->draft('Not yet');

        $this->as($this->owner, 'POST', '/api/events/' . $draft . '/messages', ['audience' => 'all', 'message' => 'Hi']);

        self::assertSame(409, $this->statusCode());
    }

    /** @return iterable<string, array{string, int}> */
    public static function finishedAgo(): iterable
    {
        yield 'within 30 days' => ['-29 days', 202];
        yield 'more than 30 days ago' => ['-31 days', 409];
    }

    #[Test]
    #[DataProvider('finishedAgo')]
    public function aFinishedEventSendsFor30Days(string $endedAgo, int $status): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $ended = new DateTimeImmutable('2026-11-21T13:20:00+00:00')->modify($endedAgo);
        self::service(Connection::class)->executeStatement(
            "UPDATE events SET status = 'ended', starts_at = :start, ends_at = :end, ended_at = :end WHERE id = :id",
            ['start' => $ended->modify('-5 hours')->format('Y-m-d H:i:s'), 'end' => $ended->format('Y-m-d H:i:s'), 'id' => $this->eventId],
        );

        $this->send(['audience' => 'all', 'message' => 'Thank you']);

        self::assertSame($status, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aPausedEventCanSendSoTheHostCanSayWhy(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'paused' WHERE id = :id", ['id' => $this->eventId]);

        $this->send(['audience' => 'all', 'message' => 'A short pause']);

        self::assertSame(202, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function chooseGuestsListsTheGuestsAToZWithWhyEmailCannotTellSome(): void
    {
        $this->add('Femi Ade', 'femi@example.test', ['Tolu Ade']);
        $this->add('Émile Okoro', null);
        $bouncing = $this->add('Ada Bello', 'ada@example.test');
        self::service(Connection::class)->executeStatement('UPDATE guests SET email_bouncing_at = NOW() WHERE id = :id', ['id' => $bouncing]);

        $guests = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->messages() . '/guests')['guests']);

        self::assertSame(200, $this->statusCode());
        self::assertSame(
            [['Ada Bello', 'bouncing', 'ada@example.test'], ['Émile Okoro', 'no_address', null], ['Femi Ade', null, 'femi@example.test']],
            Vec\map($guests, static fn (array $guest): array => [$guest['name'], $guest['flag'], $guest['email']]),
        );
    }

    #[Test]
    public function chooseGuestsIsForThoseWhoCanSendAndTheLiveSignalForThoseWhoCanRead(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);

        $this->as($viewer, 'GET', $this->messages() . '/guests');
        self::assertSame(403, $this->statusCode());

        $token = $this->as($viewer, 'POST', $this->messages() . '/subscriptions');
        self::assertSame(200, $this->statusCode());
        self::assertIsString($token['token']);
    }

    #[Test]
    public function aViewerReadsMessagesWithoutAddressesAndCannotSend(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $id = Type\string()->coerce($this->send(['audience' => 'all', 'message' => 'Hello'])['id']);
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);

        $this->as($viewer, 'POST', $this->messages(), ['audience' => 'all', 'message' => 'Me too']);
        self::assertSame(403, $this->statusCode());

        $shown = Type\dict(Type\string(), Type\mixed())->coerce($this->as($viewer, 'GET', $this->messages() . '/' . $id)['message']);
        self::assertSame(200, $this->statusCode());
        $delivery = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($shown['deliveries'])[0];
        self::assertFalse(Iter\contains_key($delivery, 'address'));
        self::assertSame('queued', $delivery['state']);
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'GET', $this->messages());

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function everySendIsAudited(): void
    {
        $this->add('Emeka Nwosu', 'emeka@example.test');
        $this->send(['audience' => 'all', 'message' => 'Hello']);

        self::assertSame(1, (int) self::service(Connection::class)->fetchOne("SELECT COUNT(*) FROM audit_entries WHERE action = 'guest_message.sent'"));
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function send(array $body): array
    {
        return $this->as($this->owner, 'POST', $this->messages(), $body);
    }

    /** @return list<array{delivery: string, recipient: Recipient, notification: RenderedNotification}> */
    private function toGuests(): array
    {
        return Vec\filter(self::service(RecordingEmailSender::class)->sent, static fn (array $sent): bool => NotificationAudienceKind::Guest === $sent['recipient']->kind);
    }

    private function deliveryOf(string $messageId): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM notification_deliveries WHERE source_id = :id', ['id' => $messageId]));
    }

    private function work(): void
    {
        $worker = self::service(NotificationWorker::class);
        $steps = 0;

        while ($steps < 50 && $worker->step()) {
            ++$steps;
        }
    }

    /** @return list<array{0: ?string, 1: string, 2: ?string}> */
    private function states(string $id): array
    {
        return Vec\map($this->deliveries($id), static fn (array $delivery): array => [
            Type\nullable(Type\string())->coerce($delivery['name']),
            Type\string()->coerce($delivery['state']),
            Type\nullable(Type\string())->coerce($delivery['reason']),
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function deliveries(string $id): array
    {
        $shown = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->messages() . '/' . $id)['message'] ?? null);

        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($shown['deliveries']);
    }

    /** @return list<string> */
    private function paths(mixed $violations): array
    {
        return Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($violations), static fn (array $violation): string => Type\string()->coerce($violation['propertyPath']));
    }

    private function messageCount(): int
    {
        return (int) self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM guest_messages');
    }

    /** @param list<string> $companions */
    private function add(string $name, ?string $email, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'email' => $email,
            'companions' => Vec\map($companions, static fn (string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function changeEmail(string $guestId, string $email): void
    {
        self::em()->clear();
        $guest = self::em()->find(Guest::class, $guestId) ?? self::fail('no guest');
        $guest->setEmail($email);
        self::em()->flush();
    }

    private function messages(): string
    {
        return '/api/events/' . $this->eventId . '/messages';
    }

    private function draft(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function live(string $name): string
    {
        $id = $this->draft($name);
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
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
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: match ($body) {
            null => null,
            [] => '{}',
            default => Json\encode($body),
        });

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
