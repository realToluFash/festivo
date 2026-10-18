<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Contacts\LinkedContacts;
use App\Domain\User\UserRegistrar;
use App\Domain\User\Verification\RecordingTextMessageSender;
use App\Entity\AuditEntry;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;

final class AlternativeContactsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADDRESS = 'folake@ire.events';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->user = $this->account(self::ADDRESS);
    }

    #[Test]
    public function anAddressIsAddedVerifiedPromotedAndTheOldOneRemoved(): void
    {
        $added = $this->call('POST', '/api/auth/emails', ['address' => '  Folake.Adeyemi@Gmail.com ']);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        self::assertSame(['address' => 'folake.adeyemi@gmail.com', 'verified' => false, 'primary' => false], [
            'address' => $added['address'], 'verified' => $added['verified'], 'primary' => $added['primary'],
        ]);
        $id = Type\string()->coerce($added['id']);

        $verified = $this->call('POST', '/api/auth/verify/email', ['address' => $id, 'code' => $this->codeFor('folake.adeyemi@gmail.com')]);
        self::assertTrue($verified['verified'] ?? null, Json\encode($verified));
        self::assertFalse($verified['primary']);

        $this->call('PATCH', '/api/auth/emails/' . $id . '/primary');
        self::assertSame(ErrorCode::ProofRequired->type(), $this->last()['type'] ?? null, 'it changes how the account signs in');
        $this->call('PATCH', '/api/auth/emails/' . $id . '/primary', ['proof' => $this->proof()]);
        self::assertSame(200, $this->statusCode());
        $old = $this->idOf(self::ADDRESS);
        $this->call('DELETE', '/api/auth/emails/' . $old);
        self::assertSame(204, $this->statusCode());

        self::assertSame([['address' => 'folake.adeyemi@gmail.com', 'verified' => true, 'primary' => true]], $this->emails());
        self::assertNotNull(self::service(UserRepository::class)->findOneByPrimaryEmailAddress('folake.adeyemi@gmail.com'));
        self::assertNull(self::service(UserRepository::class)->findOneByPrimaryEmailAddress(self::ADDRESS));
        self::assertSame(['email.added', 'email.primary', 'email.removed'], $this->audited());
    }

    #[Test]
    public function anAlternativeAddressSignsNobodyIn(): void
    {
        $this->call('POST', '/api/auth/emails', ['address' => 'second@example.com']);
        $this->call('POST', '/api/auth/verify/email', ['address' => $this->idOf('second@example.com'), 'code' => $this->codeFor('second@example.com')]);

        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->call('POST', '/api/auth/login', ['email' => 'second@example.com', 'password' => self::PASSWORD]);

        self::assertSame(ErrorCode::InvalidCredentials->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function verifiedReadsTheNewPrimaryOnceTheFlagMoves(): void
    {
        $this->call('POST', '/api/auth/emails', ['address' => 'second@example.com']);
        $id = $this->idOf('second@example.com');
        $this->call('POST', '/api/auth/verify/email', ['address' => $id, 'code' => $this->codeFor('second@example.com')]);
        $this->call('PATCH', '/api/auth/emails/' . $id . '/primary', ['proof' => $this->proof()]);

        $user = $this->fresh();
        self::assertSame('second@example.com', $user->getPrimaryEmailAddress()?->getAddress());
        self::assertTrue($user->isVerified());
    }

    #[Test]
    public function twoOfEachAtMostWithThePrimaryCounted(): void
    {
        $this->call('POST', '/api/auth/emails', ['address' => 'second@example.com']);
        $body = $this->call('POST', '/api/auth/emails', ['address' => 'third@example.com']);

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::AddressLimitReached->type(), $body['type']);
        self::assertSame('An account holds 2 email addresses. Remove one to add another.', $body['detail']);

        $this->primaryPhone();
        $this->call('POST', '/api/auth/phones', ['countryCode' => 'NG', 'number' => '0803 555 0143']);
        self::assertSame(201, $this->statusCode());
        $this->call('POST', '/api/auth/phones', ['countryCode' => 'NG', 'number' => '0803 555 0144']);
        self::assertSame(ErrorCode::AddressLimitReached->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function anAddressAlreadyLinkedAnywhereGetsOneAnswer(): void
    {
        $this->account('someone@example.com');
        $this->signInAs($this->user);

        $this->call('POST', '/api/auth/emails', ['address' => self::ADDRESS]);
        $ours = $this->withoutCorrelation();
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::AlreadyLinked->type(), $ours['type'] ?? null);

        $this->call('POST', '/api/auth/emails', ['address' => 'someone@example.com']);

        self::assertSame($ours, $this->withoutCorrelation());
    }

    #[Test]
    public function anUnverifiedAddressCannotBecomePrimary(): void
    {
        $this->call('POST', '/api/auth/emails', ['address' => 'second@example.com']);
        $body = $this->call('PATCH', '/api/auth/emails/' . $this->idOf('second@example.com') . '/primary', ['proof' => $this->proof()]);

        self::assertSame(ErrorCode::AddressNotVerified->type(), $body['type']);
        self::assertSame(self::ADDRESS, $this->fresh()->getPrimaryEmailAddress()?->getAddress());
    }

    #[Test]
    public function thePrimaryCannotBeRemoved(): void
    {
        $body = $this->call('DELETE', '/api/auth/emails/' . $this->idOf(self::ADDRESS));

        self::assertSame(ErrorCode::PrimaryAddress->type(), $body['type']);
    }

    /** At the service: over HTTP the onboarding gate refuses an account with an unverified primary first. */
    #[Test]
    public function theLastVerifiedAddressCannotBeRemoved(): void
    {
        $this->call('POST', '/api/auth/emails', ['address' => 'second@example.com']);
        $user = $this->fresh();
        $user->getPrimaryEmailAddress()?->setPrimary(false);
        self::em()->flush();
        $this->addressOf('second@example.com')->setPrimary(true);
        self::em()->flush();
        $user = $this->fresh();

        try {
            self::service(LinkedContacts::class)->removeEmail($user, Uuid::fromString($this->idOf(self::ADDRESS)));
            self::fail('the last verified address was removed');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::LastVerifiedAddress, $e->errorCode);
        }
    }

    #[Test]
    public function anUnverifiedAddressGoesWithoutAQuestion(): void
    {
        $this->call('POST', '/api/auth/emails', ['address' => 'typo@example.con']);
        $this->call('DELETE', '/api/auth/emails/' . $this->idOf('typo@example.con'));

        self::assertSame(204, $this->statusCode());
        self::assertCount(1, $this->emails());
    }

    /** Promotions in turn, through the service, leave one primary each time; the account's row lock orders ones at once. */
    #[Test]
    public function eachPromotionLeavesExactlyOnePrimary(): void
    {
        $second = new EmailAddress($this->fresh(), 'second@example.com');
        $second->setVerifiedAt(new DateTimeImmutable());
        self::em()->persist($second);
        self::em()->flush();
        $contacts = self::service(LinkedContacts::class);

        foreach (['second@example.com', self::ADDRESS, 'second@example.com'] as $next) {
            $id = Uuid::fromString($this->idOf($next));
            $proof = $this->proof();
            $contacts->makeEmailPrimary($this->fresh(), $id, $proof);
            $primaries = Vec\filter($this->fresh()->getEmailAddresses(), static fn (EmailAddress $address): bool => $address->isPrimary());

            self::assertSame([$next], Vec\map($primaries, static fn (EmailAddress $address): string => $address->getAddress()));
        }
    }

    #[Test]
    public function aPromotionReadsThePrimaryUnderTheLock(): void
    {
        $second = new EmailAddress($this->fresh(), 'second@example.com');
        $second->setVerifiedAt(new DateTimeImmutable());
        self::em()->persist($second);
        self::em()->flush();
        $id = Uuid::fromString($this->idOf(self::ADDRESS));
        $proof = $this->proof();
        $stale = $this->fresh();
        self::assertSame(self::ADDRESS, $stale->getPrimaryEmailAddress()?->getAddress());
        $connection = self::em()->getConnection();
        $connection->executeStatement('UPDATE email_addresses SET is_primary = false WHERE user_id = ?', [$stale->getId()->toRfc4122()]);
        $connection->executeStatement('UPDATE email_addresses SET is_primary = true WHERE address = ?', ['second@example.com']);

        self::service(LinkedContacts::class)->makeEmailPrimary($stale, $id, $proof);
        $primaries = Vec\filter($this->fresh()->getEmailAddresses(), static fn (EmailAddress $address): bool => $address->isPrimary());

        self::assertSame([self::ADDRESS], Vec\map($primaries, static fn (EmailAddress $address): string => $address->getAddress()));
    }

    #[Test]
    public function anotherAccountsAddressIsNotFound(): void
    {
        $other = $this->account('someone@example.com');
        $theirs = $other->getPrimaryEmailAddress()?->getId()->toRfc4122() ?? self::fail('no address');
        $this->signInAs($this->user);

        $proof = $this->proof();

        foreach ([['PATCH', '/primary'], ['DELETE', '']] as [$method, $suffix]) {
            $body = $this->call($method, '/api/auth/emails/' . $theirs . $suffix, ['proof' => $proof]);
            self::assertSame(404, $this->statusCode(), $method);
            self::assertSame(ErrorCode::NotFound->type(), $body['type'], $method);
        }

        $this->call('POST', '/api/auth/verify/email', ['address' => $theirs, 'code' => '123456']);
        self::assertSame(404, $this->statusCode());
        $this->call('DELETE', '/api/auth/emails/not-a-uuid');
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aNumberIsAddedVerifiedPromotedAndTheOldOneRemoved(): void
    {
        $this->primaryPhone();
        $added = $this->call('POST', '/api/auth/phones', ['countryCode' => 'NG', 'number' => '0803 555 0143']);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        self::assertFalse($added['primary']);
        $id = Type\string()->coerce($added['id']);

        $this->call('PATCH', '/api/auth/phones/' . $id . '/primary');
        self::assertSame(ErrorCode::AddressNotVerified->type(), $this->last()['type'] ?? null);

        $this->call('POST', '/api/auth/verify/phone', ['phone' => $id, 'code' => $this->codeTo('+2348035550143')]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->call('PATCH', '/api/auth/phones/' . $id . '/primary');
        self::assertSame(200, $this->statusCode());

        $old = $this->fresh()->getPhoneNumbers();
        $before = Vec\filter($old, static fn (PhoneNumber $phone): bool => !$phone->isPrimary())[0] ?? self::fail('the old number is gone');
        $this->call('DELETE', '/api/auth/phones/' . $before->getId()->toRfc4122());

        self::assertSame(204, $this->statusCode());
        self::assertSame('+2348035550143', $this->fresh()->getPrimaryPhoneNumber()?->getNumber());
        self::assertSame(['phone.added', 'phone.primary', 'phone.removed'], $this->audited());
    }

    #[Test]
    public function theFirstNumberVerifiedOnAnAccountWithNoPrimaryBecomesPrimary(): void
    {
        $first = $this->addPhone('0803 555 0143');
        $second = $this->addPhone('0803 555 0144');

        $verified = $this->call('POST', '/api/auth/verify/phone', ['phone' => $first, 'code' => $this->codeTo('+2348035550143')]);
        self::assertSame(200, $this->statusCode(), Json\encode($verified));
        self::assertTrue($verified['primary']);
        $this->call('POST', '/api/auth/verify/phone', ['phone' => $second, 'code' => $this->codeTo('+2348035550144')]);
        self::assertFalse($this->last()['primary']);

        self::assertSame([
            ['number' => '+2348035550143', 'verified' => true, 'primary' => true],
            ['number' => '+2348035550144', 'verified' => true, 'primary' => false],
        ], $this->phones());
        self::assertSame(['phone.added', 'phone.added', 'phone.primary'], $this->audited());
    }

    #[Test]
    public function aNumberVerifiedBesideAPrimaryStaysAnAlternative(): void
    {
        $this->primaryPhone();
        $added = $this->addPhone('0803 555 0143');

        $verified = $this->call('POST', '/api/auth/verify/phone', ['phone' => $added, 'code' => $this->codeTo('+2348035550143')]);

        self::assertFalse($verified['primary']);
        self::assertSame('+2348035550142', $this->fresh()->getPrimaryPhoneNumber()?->getNumber());
        self::assertSame(['phone.added'], $this->audited());
    }

    #[Test]
    public function anUnverifiedNumberNeverBecomesPrimary(): void
    {
        $added = $this->addPhone('0803 555 0143');
        $wrong = '000000' === $this->codeTo('+2348035550143') ? '111111' : '000000';

        $this->call('POST', '/api/auth/verify/phone', ['phone' => $added, 'code' => $wrong]);

        self::assertSame(ErrorCode::VerificationCodeInvalid->type(), $this->last()['type'] ?? null);
        self::assertSame([['number' => '+2348035550143', 'verified' => false, 'primary' => false]], $this->phones());
    }

    #[Test]
    public function addingIsRateLimited(): void
    {
        self::getContainer()->set('limiter.contact_add_account', new RefusingRateLimiterFactory());

        $this->call('POST', '/api/auth/emails', ['address' => 'one-more@example.com']);

        self::assertSame(429, $this->statusCode());
        self::assertSame(ErrorCode::TooManyAttempts->type(), $this->last()['type'] ?? null);
        self::assertNotNull($this->client->getResponse()->headers->get('Retry-After'));
        self::assertCount(1, $this->emails(), 'nothing was added');
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Folake', self::PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        self::onboard($user);
        self::em()->flush();
        $this->signInAs($user);

        return $user;
    }

    private function proof(): string
    {
        $body = $this->call('POST', '/api/auth/proof', ['password' => self::PASSWORD]);

        return Type\string()->coerce($body['proof'] ?? self::fail(Json\encode($body)));
    }

    private function primaryPhone(): void
    {
        $phone = new PhoneNumber($this->fresh(), '+2348035550142', true, 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        self::em()->persist($phone);
        self::em()->flush();
    }

    private function addPhone(string $number): string
    {
        $added = $this->call('POST', '/api/auth/phones', ['countryCode' => 'NG', 'number' => $number]);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        self::assertFalse($added['primary']);

        return Type\string()->coerce($added['id']);
    }

    /** @return list<array{number: string, verified: bool, primary: bool}> */
    private function phones(): array
    {
        $me = $this->call('GET', '/api/auth/me');
        $phones = Vec\map(
            Type\vec(Type\shape(['number' => Type\string(), 'verified' => Type\bool(), 'primary' => Type\bool()], true))->coerce($me['phoneNumbers']),
            static fn (array $phone): array => ['number' => $phone['number'], 'verified' => $phone['verified'], 'primary' => $phone['primary']],
        );

        return Vec\sort_by($phones, static fn (array $phone): string => $phone['number']);
    }

    private function signInAs(User $user): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    private function fresh(): User
    {
        self::em()->clear();

        return Type\instance_of(User::class)->coerce(self::em()->find(User::class, $this->user->getId()));
    }

    private function addressOf(string $address): EmailAddress
    {
        return Type\instance_of(EmailAddress::class)->coerce(self::em()->getRepository(EmailAddress::class)->findOneBy(['address' => $address]));
    }

    private function idOf(string $address): string
    {
        self::em()->clear();

        return $this->addressOf($address)->getId()->toRfc4122();
    }

    /** @return list<array{address: string, verified: bool, primary: bool}> */
    private function emails(): array
    {
        $me = $this->call('GET', '/api/auth/me');

        return Vec\map(
            Type\vec(Type\shape(['address' => Type\string(), 'verified' => Type\bool(), 'primary' => Type\bool()], true))->coerce($me['emailAddresses']),
            static fn (array $email): array => ['address' => $email['address'], 'verified' => $email['verified'], 'primary' => $email['primary']],
        );
    }

    /** @return list<string> */
    private function audited(): array
    {
        $entries = self::em()->getRepository(AuditEntry::class)->findBy(['subjectId' => $this->user->getId()], ['occurredAt' => 'ASC', 'id' => 'ASC']);

        return Vec\values(Vec\filter(
            Vec\map($entries, static fn (AuditEntry $entry): string => $entry->action()),
            static fn (string $action): bool => Str\starts_with($action, 'email.') || Str\starts_with($action, 'phone.'),
        ));
    }

    private function codeFor(string $address): string
    {
        foreach (Vec\reverse(self::getMailerMessages()) as $message) {
            if ($message instanceof Email && $message->getTo()[0]->getAddress() === $address) {
                return Regex\first_match((string) $message->getTextBody(), '/(\d{6})/')[1] ?? '';
            }
        }

        self::fail(Str\format('nothing was emailed to %s', $address));
    }

    private function codeTo(string $number): string
    {
        foreach (Vec\reverse(self::service(RecordingTextMessageSender::class)->sent) as $text) {
            if ($text['to'] === $number) {
                return Regex\first_match($text['body'], '/(\d{6})/')[1] ?? '';
            }
        }

        self::fail(Str\format('nothing was texted to %s', $number));
    }

    /** @return array<string, mixed> */
    private function withoutCorrelation(): array
    {
        $body = $this->last();
        unset($body['correlationId']);

        return $body;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));

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
