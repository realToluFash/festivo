<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\GuestMessages\GuestEmailUnsubscribe;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Messaging\NotificationWorker;
use App\Domain\Messaging\Webhook\MailWebhook;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Recovery\PasswordRecovery;
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
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;

final class YourMessagesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADDRESS = 'emeka@example.test';

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
        $this->eventId = $this->live($this->organisation, $this->owner, "Amara & Tobi's wedding");
    }

    #[Test]
    public function theEmailCarriesItsOneClickUnsubscribe(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $this->sendAndWork();

        $unsubscribe = $this->toGuests()[0]['notification']->unsubscribe;
        self::assertSame(self::service(GuestEmailUnsubscribe::class)->url($this->guest($guest)), $unsubscribe);
        self::assertStringContainsString(GuestEmailUnsubscribe::PATH . $this->token($guest), $unsubscribe);
    }

    #[Test]
    public function theOneClickPostStopsTheNextEmailAndUndoLetsItGoAgain(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);

        $this->oneClick($this->token($guest));
        self::assertSame(200, $this->statusCode());
        self::assertSame('', (string) $this->client->getResponse()->getContent());
        self::assertSame([['not_sent', 'unsubscribed']], $this->nextSend());

        $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'email', 'on' => true]);
        self::assertSame([['queued', null]], $this->nextSend());
    }

    #[Test]
    public function thePagesButtonStopsTheNextEmail(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);

        $answer = $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'email', 'on' => false]);

        self::assertSame(200, $this->statusCode(), Json\encode($answer));
        self::assertSame(['onRecord' => true, 'on' => false], $this->channel($answer, 'email'));
        self::assertSame([['not_sent', 'unsubscribed']], $this->nextSend());
    }

    #[Test]
    public function theEmailSwitchOpenedFromTheGuestsPageStopsTheNextEmailAndTurnsItBackOn(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $link = $this->guest($guest)->getLinkToken() ?? self::fail('no link');

        $this->page('PUT', ['guestToken' => $link, 'channel' => 'email', 'on' => false]);
        self::assertSame([['not_sent', 'unsubscribed']], $this->nextSend());

        $this->page('PUT', ['guestToken' => $link, 'channel' => 'email', 'on' => true]);
        self::assertSame([['queued', null]], $this->nextSend());
    }

    #[Test]
    public function aHardBounceStopsTheNextEmail(): void
    {
        $this->add('Emeka Nwosu', self::ADDRESS);
        $first = $this->sendAndWork();

        self::service(MailWebhook::class)->receive(['RecordType' => 'Bounce', 'Type' => 'HardBounce', 'Email' => self::ADDRESS, 'Metadata' => ['delivery' => $this->deliveryOf($first)]]);

        self::assertSame([['not_sent', 'bouncing']], $this->nextSend());
    }

    #[Test]
    public function aComplaintStopsTheNextEmail(): void
    {
        $this->add('Emeka Nwosu', self::ADDRESS);
        $first = $this->sendAndWork();

        self::service(MailWebhook::class)->receive(['RecordType' => 'SpamComplaint', 'Email' => self::ADDRESS, 'Metadata' => ['delivery' => $this->deliveryOf($first)]]);

        self::assertSame([['not_sent', 'complained']], $this->nextSend());
    }

    #[Test]
    public function aThirdSoftBounceInARowStopsTheNextEmailAndADeliveryBetweenStartsTheCountAgain(): void
    {
        $this->add('Emeka Nwosu', self::ADDRESS);
        $soft = function (string $message): void {
            self::service(MailWebhook::class)->receive(['RecordType' => 'Bounce', 'Type' => 'SoftBounce', 'Email' => self::ADDRESS, 'Metadata' => ['delivery' => $this->deliveryOf($message)]]);
        };

        $soft($this->sendAndWork());
        $soft($this->sendAndWork());
        self::service(MailWebhook::class)->receive(['RecordType' => 'Delivery', 'Email' => self::ADDRESS, 'Metadata' => ['delivery' => $this->deliveryOf($this->sendAndWork())]]);
        $soft($this->sendAndWork());
        $soft($this->sendAndWork());
        self::assertSame([['queued', null]], $this->nextSend(), 'two in a row since the delivery');

        $soft($this->sendAndWork());

        self::assertSame([['not_sent', 'bouncing']], $this->nextSend());
    }

    #[Test]
    public function aGetMadeTwiceRecordsNothingAndOpensThePageWithTheTokenAfterItsHash(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $token = $this->token($guest);

        foreach ([1, 2] as $_) {
            $this->client->request('GET', GuestEmailUnsubscribe::PATH . $token);
            $response = $this->client->getResponse();
            self::assertSame(303, $response->getStatusCode());
            self::assertStringEndsWith(GuestEmailUnsubscribe::PAGE . $token, (string) $response->headers->get('Location'));
            self::assertSame('no-referrer', $response->headers->get('Referrer-Policy'));
            self::assertStringContainsString('noindex', (string) $response->headers->get('X-Robots-Tag'));
        }

        self::assertSame(0, $this->suppressions());
        self::assertSame([['queued', null]], $this->nextSend());
    }

    #[Test]
    public function aTamperedOrUnknownTokenChangesNothing(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $token = $this->token($guest);
        $tampered = Str\slice($token, 0, 43) . ('A' === Str\slice($token, 43) ? 'B' : 'A');
        $otherOrganisations = self::service(GuestEmailUnsubscribe::class)->token($this->guest($guest)->getId(), $this->otherOrganisation()->getId());

        foreach ([$tampered, 'not-a-token', $otherOrganisations] as $bad) {
            $this->oneClick($bad);
            self::assertSame(404, $this->statusCode());
            $this->page('POST', ['token' => $bad]);
            self::assertSame(404, $this->statusCode());
            $this->page('PUT', ['token' => $bad, 'channel' => 'email', 'on' => false]);
            self::assertSame(404, $this->statusCode());
        }

        self::assertSame(0, $this->suppressions());
    }

    #[Test]
    public function aLinkFromAnEmailOfAnyAgeStillWorks(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $token = $this->token($guest);
        self::mockTime(new DateTimeImmutable('2029-06-01T09:00:00+00:00'));

        $this->oneClick($token);

        self::assertSame(200, $this->statusCode());
        self::assertSame(1, $this->suppressions());
    }

    #[Test]
    public function anOptOutStopsOnlyThisOrganisation(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $this->oneClick($this->token($guest));

        $otherOwner = $this->account('owner@other.events');
        $other = self::service(OrganisationFounder::class)->found($otherOwner, 'Other Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $otherEvent = $this->live($other, $otherOwner, 'Gala');
        $this->as($otherOwner, 'POST', '/api/events/' . $otherEvent . '/guests', ['fullName' => 'Emeka Nwosu', 'email' => self::ADDRESS]);
        $sent = $this->as($otherOwner, 'POST', '/api/events/' . $otherEvent . '/messages', ['audience' => 'all', 'message' => 'Hello']);

        self::assertSame(['email' => 1], $sent['queued']);
        self::assertSame([['not_sent', 'unsubscribed']], $this->nextSend());
    }

    #[Test]
    public function theAnswerCarriesNoNameNoAddressAndNoNumber(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS, '0803 123 4567');

        $this->page('POST', ['token' => $this->token($guest)]);
        $raw = (string) $this->client->getResponse()->getContent();

        self::assertSame(200, $this->statusCode(), $raw);
        self::assertSame('no-referrer', $this->client->getResponse()->headers->get('Referrer-Policy'));
        self::assertSame([
            'organisation' => 'Ìrè Events',
            'channels' => [
                'email' => ['onRecord' => true, 'on' => true],
                'texts' => ['onRecord' => true, 'on' => true],
                'whatsApp' => ['onRecord' => true, 'on' => true],
            ],
        ], Json\decode($raw));

        foreach (['Emeka', 'Nwosu', 'emeka@', '803', '+234'] as $personal) {
            self::assertStringNotContainsString($personal, $raw);
        }
    }

    #[Test]
    public function aChannelWithNoAddressOnRecordHasNothingToTurnAndRecordsNothing(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);

        $answer = $this->page('POST', ['token' => $this->token($guest)]);
        self::assertSame(['onRecord' => false, 'on' => false], $this->channel($answer, 'texts'));
        self::assertSame(['onRecord' => false, 'on' => false], $this->channel($answer, 'whatsApp'));

        $refused = $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'texts', 'on' => false]);

        self::assertSame(422, $this->statusCode(), Json\encode($refused));
        self::assertSame(0, $this->suppressions());
    }

    #[Test]
    public function theTextsAndWhatsAppSwitchesPutTheNumberOnTheListForThisOrganisation(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS, '0803 123 4567');

        $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'texts', 'on' => false]);
        $answer = $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'whatsApp', 'on' => false]);

        self::assertSame(['onRecord' => true, 'on' => false], $this->channel($answer, 'texts'));
        self::assertSame(['onRecord' => true, 'on' => false], $this->channel($answer, 'whatsApp'));
        self::assertSame(['onRecord' => true, 'on' => true], $this->channel($answer, 'email'));
        $organisation = $this->organisation->getId()->toRfc4122();
        self::assertSame(
            [[$organisation, 'sms', 'opted_out'], [$organisation, 'whatsapp', 'opted_out']],
            Vec\map(self::service(Connection::class)->fetchAllAssociative('SELECT organisation_id, channel, reason FROM guest_suppressions ORDER BY channel'), static fn (array $row): array => Vec\values($row)),
        );
    }

    #[Test]
    public function theGuestsDetailsShowEachOptOutOnceWithGuestsManageAndNoneWithGuestsReadAlone(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS, '0803 123 4567');
        $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'texts', 'on' => false]);
        $this->page('PUT', ['token' => $this->token($guest), 'channel' => 'whatsApp', 'on' => false]);

        $details = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest)['guest'] ?? null);
        self::assertSame(['email' => null, 'texts' => '2026-11-21T13:20:00+00:00', 'whatsApp' => '2026-11-21T13:20:00+00:00'], $details['optOuts']);

        $viewer = $this->member('viewer@ire.events', EventRole::CanView);
        $viewed = Type\dict(Type\string(), Type\mixed())->coerce($this->as($viewer, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest)['guest'] ?? null);
        self::assertSame(200, $this->statusCode());
        self::assertFalse(Iter\contains_key($viewed, 'optOuts'));
    }

    #[Test]
    public function aLineGoesOnceTheRowHoldsAnotherAddress(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $this->oneClick($this->token($guest));
        self::em()->clear();
        $this->guest($guest)->setEmail('new@example.test');
        self::em()->flush();

        $details = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/guests/' . $guest)['guest'] ?? null);

        self::assertSame(['email' => null, 'texts' => null, 'whatsApp' => null], $details['optOuts']);
    }

    #[Test]
    public function anErasureKeepsTheOptOutSoAGuestAddedAgainWithTheAddressIsStillNotEmailed(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);
        $this->oneClick($this->token($guest));

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->eventId . '/guests/' . $guest);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/erasure');
        self::assertSame(204, $this->statusCode());
        self::assertSame(0, (int) self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM guests WHERE email = :address', ['address' => self::ADDRESS]));

        $this->add('Emeka Nwosu', ' Emeka@Example.test ');

        self::assertSame([['not_sent', 'unsubscribed']], $this->nextSend());
        self::assertStringNotContainsString('emeka', Json\encode(self::service(Connection::class)->fetchAllAssociative('SELECT * FROM guest_suppressions')));
    }

    #[Test]
    public function theGuestsPageNamesTheOrganisationForItsWayIn(): void
    {
        $guest = $this->add('Emeka Nwosu', self::ADDRESS);

        $page = $this->page('POST', ['token' => $this->guest($guest)->getLinkToken()], '/api/guest-links/page');

        self::assertSame('Ìrè Events', Type\shape(['organisation' => Type\string()], true)->coerce($page['event'] ?? null)['organisation']);
    }

    #[Test]
    public function aPasswordResetStillReachesAnAddressThatStoppedAnOrganisationsEmails(): void
    {
        $guest = $this->add('Owner Again', 'owner@ire.events');
        $this->oneClick($this->token($guest));

        self::service(PasswordRecovery::class)->request('owner@ire.events', 'en');

        $mail = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        self::assertSame('owner@ire.events', $mail->getTo()[0]->getAddress());
    }

    private function token(string $guestId): string
    {
        $guest = $this->guest($guestId);

        return self::service(GuestEmailUnsubscribe::class)->token($guest->getId(), $guest->getEvent()->getOrganisation()->getId());
    }

    private function guest(string $id): Guest
    {
        return self::em()->find(Guest::class, $id) ?? self::fail('no guest');
    }

    private function otherOrganisation(): Organisation
    {
        $owner = $this->account('owner@elsewhere.events');
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        return $organisation;
    }

    private function oneClick(#[SensitiveParameter] string $token): void
    {
        $this->client->request('POST', GuestEmailUnsubscribe::PATH . $token, ['List-Unsubscribe' => 'One-Click'], server: ['CONTENT_TYPE' => 'application/x-www-form-urlencoded']);
    }

    /** @param array<string, mixed> $body */
    private function page(string $method, array $body, string $path = '/api/your-messages'): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($body));

        return $this->last();
    }

    private function channel(mixed $answer, string $channel): mixed
    {
        $channels = Type\shape(['channels' => Type\dict(Type\string(), Type\shape(['onRecord' => Type\bool(), 'on' => Type\bool()]))], true)->coerce($answer)['channels'];

        return $channels[$channel] ?? null;
    }

    /** @return list<array{0: string, 1: ?string}> */
    private function nextSend(): array
    {
        $sent = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/messages', ['audience' => 'all', 'message' => 'Next']);
        self::assertSame(202, $this->statusCode(), Json\encode($sent));
        $shown = Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/messages/' . Type\string()->coerce($sent['id']))['message'] ?? null);

        return Vec\map(
            Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($shown['deliveries']),
            static fn (array $delivery): array => [Type\string()->coerce($delivery['state']), Type\nullable(Type\string())->coerce($delivery['reason'])],
        );
    }

    private function sendAndWork(): string
    {
        $id = Type\string()->coerce($this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/messages', ['audience' => 'all', 'message' => 'Hello'])['id']);
        $worker = self::service(NotificationWorker::class);
        $steps = 0;

        while ($steps < 50 && $worker->step()) {
            ++$steps;
        }

        return $id;
    }

    /** @return list<array{delivery: string, recipient: Recipient, notification: RenderedNotification}> */
    private function toGuests(): array
    {
        return Vec\values(Vec\filter(self::service(RecordingEmailSender::class)->sent, static fn (array $sent): bool => NotificationAudienceKind::Guest === $sent['recipient']->kind));
    }

    private function deliveryOf(string $messageId): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM notification_deliveries WHERE source_id = :id', ['id' => $messageId]));
    }

    private function suppressions(): int
    {
        return (int) self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM guest_suppressions');
    }

    private function add(string $name, ?string $email, ?string $mobile = null): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            'fullName' => $name,
            'email' => $email,
            ...null === $mobile ? [] : ['mobile' => ['countryCode' => 'NG', 'number' => $mobile]],
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    private function live(Organisation $organisation, User $owner, string $name): string
    {
        $body = $this->as($owner, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($owner, 'POST', '/api/events/' . $id . '/make-live');
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

    /** @param ?array<string, mixed> $body */
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
