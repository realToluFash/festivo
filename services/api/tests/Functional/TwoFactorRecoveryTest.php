<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\TokenIssuer;
use App\Domain\User\TwoFactor\Recovery\NotMeLink;
use App\Domain\User\UserRegistrar;
use App\Domain\User\Verification\PhoneCodeChannels;
use App\Domain\User\Verification\RecordingTextMessageSender;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\RefreshToken;
use App\Entity\Role;
use App\Entity\TwoFactorRecovery;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Repository\TwoFactorFactorRepository;
use App\Tests\ApiTestCase;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Mime\Email;

/** sc-509: back in after losing both the authenticator and the recovery codes, never on one channel alone. */
final class TwoFactorRecoveryTest extends ApiTestCase
{
    use ClockSensitiveTrait;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADDRESS = 'folake@example.com';

    private User $person;

    private User $approver;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::getContainer()->set(PhoneCodeChannels::class, new PhoneCodeChannels(false, ''));

        $this->person = $this->account(self::ADDRESS, 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->person, 'Ìrè Events', 'NG', 'Africa/Lagos');
        $this->approver = $this->account('bisi@example.com', 'Bisi Ade');
        $this->join($this->approver, SeededRole::Owner);
        self::em()->flush();
        $this->turnOnTwoFactor();
    }

    #[Test]
    public function anEmailCodeAloneProvesItWhenThereIsNoVerifiedPhone(): void
    {
        $opening = $this->call('POST', '/api/auth/two-factor/recovery/opening', ['challenge' => $this->challenge()]);
        self::assertSame([self::ADDRESS, null, ['Ìrè Events'], false], [$opening['email'], $opening['phone'], $opening['organisations'], $opening['nobody']]);
        self::assertNull($opening['recovery'], 'nothing open yet, and nothing sent');
        self::assertSame([], self::getMailerMessages());

        $handle = $this->start();
        $state = $this->prove($handle, $this->emailCode());

        self::assertSame(200, $this->statusCode(), Json\encode($state));
        self::assertArrayNotHasKey('accessToken', $this->last(), 'waiting is not access');
        self::assertSame('waiting', $state['status']);
        self::assertNull($state['codes']);
        self::assertSame(['Somebody asked to get into your account without two-factor'], $this->headingsTo(self::ADDRESS, 'A request to get into your Soirely account'));
        self::assertStringContainsString('proved their email address with a code. They have no verified phone.', $this->mailTo('bisi@example.com', 'Folake Adeyemi asked to get back into their account'));
        self::assertSame([], $this->mailsTo(self::ADDRESS, 'Folake Adeyemi asked to get back into their account'), 'never to the person');
    }

    #[Test]
    public function bothCodesAreNeededWhenThePhoneIsVerified(): void
    {
        $this->verifiedPhone();
        $handle = $this->start();
        $emailCode = $this->emailCode();
        $phoneCode = $this->textedCode();

        $this->call('POST', '/api/auth/two-factor/recovery/prove', ['recovery' => $handle, 'emailCode' => $emailCode]);
        self::assertSame(422, $this->statusCode(), 'the phone code is required');

        $this->call('POST', '/api/auth/two-factor/recovery/prove', ['recovery' => $handle, 'emailCode' => $emailCode, 'phoneCode' => self::wrongOf($phoneCode)]);
        self::assertSame(ErrorCode::VerificationCodeInvalid->type(), $this->last()['type']);
        self::assertSame(['phoneCode'], $this->violatedFields(), 'only the wrong one is marked');

        $this->call('POST', '/api/auth/two-factor/recovery/prove', ['recovery' => $handle, 'emailCode' => self::wrongOf($emailCode), 'phoneCode' => $phoneCode]);
        self::assertSame(['emailCode'], $this->violatedFields());
        self::assertSame('proving', $this->state($handle)['status'], 'neither right code was spent by the other being wrong');

        self::assertSame('waiting', $this->prove($handle, $emailCode, $phoneCode)['status']);
        self::assertStringContainsString('proved their email address and phone with codes', $this->mailTo('bisi@example.com', 'Folake Adeyemi asked to get back into their account'));
    }

    #[Test]
    public function fiveWrongTriesSpendTheCodesUntilNewOnesAreSent(): void
    {
        $handle = $this->start();
        $code = $this->emailCode();

        foreach (Vec\range(1, 5) as $_) {
            $this->call('POST', '/api/auth/two-factor/recovery/prove', ['recovery' => $handle, 'emailCode' => self::wrongOf($code)]);
        }

        self::assertSame(ErrorCode::VerificationCodeExhausted->type(), $this->last()['type']);
        self::assertSame('exhausted', Type\shape(['state' => Type\string()], true)->coerce($this->state($handle)['codes'])['state']);
        $this->prove($handle, $code);
        self::assertSame(ErrorCode::VerificationCodeExhausted->type(), $this->last()['type'], 'even the right one, once spent');
    }

    #[Test]
    public function approvalTurnsTwoFactorOffEndsEverySessionAndAsksToSetItUpAgain(): void
    {
        $sessions = $this->signedInElsewhere(2);
        $handle = $this->proved();

        $requests = $this->asApprover('GET', '/api/auth/recovery-requests');
        $request = Type\shape(['id' => Type\string(), 'name' => Type\string(), 'own' => Type\bool(), 'provedPhone' => Type\bool()], true)->coerce(Type\vec(Type\mixed())->coerce($requests['requests'])[0] ?? null);
        self::assertSame(['Folake Adeyemi', false, false], [$request['name'], $request['own'], $request['provedPhone']]);

        $this->asApprover('POST', '/api/auth/recovery-requests/' . $request['id'] . '/approve');
        self::assertSame(204, $this->statusCode());
        self::assertCount(1, $this->mailsTo(self::ADDRESS, 'Your request was approved'));
        self::assertCount(1, $this->mailsTo(self::ADDRESS, 'Two-factor is off for your Soirely account'));

        self::assertNull(self::service(TwoFactorFactorRepository::class)->findActiveFor($this->fresh($this->person)));
        self::assertSame($sessions, $this->revoked(), 'every session ended');
        self::assertSame('approved', $this->state($handle)['status']);
        self::assertTrue($this->fresh($this->person)->hasTwoFactorSetupPrompt());
        self::assertSame(['two_factor_recovery.started', 'two_factor_recovery.requested', 'two_factor_recovery.approved'], $this->audited());

        $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::PASSWORD]);
        self::assertSame(200, $this->statusCode(), 'signs in with the password alone now');
        self::assertTrue(Type\shape(['account' => Type\shape(['twoFactorSetupPrompt' => Type\bool()], true)], true)->coerce($this->last())['account']['twoFactorSetupPrompt']);

        $this->authenticatedAs($this->person);
        $this->call('DELETE', '/api/auth/two-factor/setup-prompt');
        self::assertFalse($this->fresh($this->person)->hasTwoFactorSetupPrompt(), '"Not now"');
    }

    #[Test]
    public function aTurnedDownRequestChangesNothing(): void
    {
        $handle = $this->proved();

        $this->asApprover('POST', '/api/auth/recovery-requests/' . $this->requestId() . '/turn-down');

        self::assertSame(204, $this->statusCode());
        self::assertCount(1, $this->mailsTo(self::ADDRESS, 'Your request was turned down'));
        self::assertSame('turned_down', $this->state($handle)['status']);
        self::assertNotNull(self::service(TwoFactorFactorRepository::class)->findActiveFor($this->fresh($this->person)));
        $this->asApprover('POST', '/api/auth/recovery-requests/' . $this->requestId() . '/approve');
        self::assertSame(ErrorCode::RecoveryRequestClosed->type(), $this->last()['type'], 'one answer, and it stands');
    }

    #[Test]
    public function nobodyAnswersTheirOwnRequest(): void
    {
        $handle = $this->proved();
        $this->authenticatedAs($this->person);
        $requests = Type\vec(Type\shape(['id' => Type\string(), 'own' => Type\bool()], true))->coerce($this->call('GET', '/api/auth/recovery-requests')['requests']);

        self::assertTrue($requests[0]['own']);
        $this->call('POST', '/api/auth/recovery-requests/' . $requests[0]['id'] . '/approve');
        self::assertSame(403, $this->statusCode());
        self::assertSame('waiting', $this->state($handle)['status']);
    }

    #[Test]
    public function nobodyToApproveIsSaidBeforeAnyCodeIsSent(): void
    {
        $this->leaves($this->approver);
        $challenge = $this->challenge();

        self::assertTrue($this->call('POST', '/api/auth/two-factor/recovery/opening', ['challenge' => $challenge])['nobody']);
        self::assertSame('support@soirely.com', $this->last()['supportAddress']);
        $this->call('POST', '/api/auth/two-factor/recovery', ['challenge' => $challenge]);
        self::assertSame(ErrorCode::RecoveryNobodyToApprove->type(), $this->last()['type']);
        self::assertSame([], self::getMailerMessages());
    }

    #[Test]
    public function nobodyToApproveAtTheStartCreatesNothingAndCountsNothing(): void
    {
        $this->leaves($this->approver);

        foreach (Vec\range(1, 4) as $_) {
            $this->call('POST', '/api/auth/two-factor/recovery', ['challenge' => $this->challenge()]);
            self::assertSame(ErrorCode::RecoveryNobodyToApprove->type(), $this->last()['type']);
        }

        self::assertSame([], self::em()->getRepository(TwoFactorRecovery::class)->findAll());
        $this->join($this->approver, SeededRole::Owner);
        self::em()->flush();
        $this->start();
    }

    #[Test]
    public function anApproverWhoLeavesBeforeTheProofLeavesNobodyWaitingSevenDays(): void
    {
        $handle = $this->start();
        $code = $this->emailCode();
        $this->leaves($this->approver);

        $this->prove($handle, $code);

        self::assertSame(ErrorCode::RecoveryNobodyToApprove->type(), $this->last()['type']);
        self::assertSame([], $this->mailsTo('bisi@example.com', 'Folake Adeyemi asked to get back into their account'));
        self::assertSame('cancelled', $this->state($handle)['status']);
        self::assertSame(['two_factor_recovery.started', 'two_factor_recovery.nobody_to_approve'], $this->audited());
    }

    #[Test]
    public function thisWasntMeCancelsTheRequestAndEndsEverySession(): void
    {
        $sessions = $this->signedInElsewhere(1);
        $handle = $this->proved();
        $recovery = Type\instance_of(TwoFactorRecovery::class)->coerce(self::em()->getRepository(TwoFactorRecovery::class)->findAll()[0] ?? null);
        $link = self::service(NotMeLink::class)->url($recovery);
        self::assertStringContainsString($link, $this->mailTo(self::ADDRESS, 'A request to get into your Soirely account'));
        $query = [];
        \parse_str(Type\string()->coerce(\parse_url($link, \PHP_URL_QUERY)), $query);

        $this->call('POST', '/api/auth/two-factor/recovery/not-me', ['request' => $query['request'], 'token' => Str\repeat('0', 64)]);
        self::assertSame(ErrorCode::RecoveryRequestInvalid->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/two-factor/recovery/not-me', ['request' => $query['request'], 'token' => $query['token']]);
        self::assertSame(204, $this->statusCode());
        self::assertSame('cancelled', $this->state($handle)['status']);
        self::assertSame($sessions, $this->revoked());
        self::assertSame([], $this->asApprover('GET', '/api/auth/recovery-requests')['requests']);
    }

    #[Test]
    public function cancellingFromTheWaitingScreenEndsEverySessionToo(): void
    {
        $sessions = $this->signedInElsewhere(1);
        $handle = $this->proved();

        self::assertSame('cancelled', Type\shape(['status' => Type\string()], true)->coerce($this->call('POST', '/api/auth/two-factor/recovery/cancel', ['recovery' => $handle])['state'])['status']);
        self::assertSame($sessions, $this->revoked());
    }

    /** The AC's own instant: proved at 13:20Z, ending 7 × 24 h later, read in each reader's zone. */
    #[Test]
    public function theExpiryIsOneInstantInEveryReadersZone(): void
    {
        self::mockTime('2026-10-17 13:20:00');
        $handle = $this->proved();
        $ends = static fn (array $state): mixed => $state['expires'];

        $this->fresh($this->person)->setTimezone('Africa/Lagos');
        self::em()->flush();
        self::assertSame('Saturday, Oct 24 at 14:20 WAT', $ends($this->state($handle)));
        $this->fresh($this->person)->setTimezone('Europe/London');
        self::em()->flush();
        self::assertSame('Saturday, Oct 24 at 14:20 BST', $ends($this->state($handle)));
        $this->fresh($this->person)->setTimezone(null);
        self::em()->flush();
        self::assertSame('Saturday, Oct 24 at 13:20 UTC', $ends($this->state($handle)));
        self::assertSame('2026-10-24T13:20:00+00:00', $this->state($handle)['expiresAt']);

        self::mockTime('2026-10-24 13:19:59');
        $this->asApprover('POST', '/api/auth/recovery-requests/' . $this->requestId() . '/approve');
        self::assertSame(204, $this->statusCode(), 'one second before the instant');
    }

    #[Test]
    public function anApprovalAtTheInstantIsRefusedAsExpired(): void
    {
        self::mockTime('2026-10-17 13:20:00');
        $handle = $this->proved();
        $id = $this->requestId();

        self::mockTime('2026-10-24 13:20:00');
        $this->asApprover('POST', '/api/auth/recovery-requests/' . $id . '/approve');

        self::assertSame(ErrorCode::RecoveryRequestClosed->type(), $this->last()['type']);
        self::assertSame('expired', $this->last()['requestStatus']);
        self::assertSame('expired', $this->state($handle)['status']);
        self::assertNotNull(self::service(TwoFactorFactorRepository::class)->findActiveFor($this->fresh($this->person)));

        $this->bootCommand('app:two-factor-recovery:expire');
        self::assertCount(1, $this->mailsTo(self::ADDRESS, 'Your request has expired'));
    }

    #[Test]
    public function threeRequestsADayAndANewOneEndsTheLast(): void
    {
        $first = $this->start();
        $this->start();
        self::assertSame('cancelled', $this->state($first)['status'], 'starting again ends the one before');
        $this->start();

        $this->call('POST', '/api/auth/two-factor/recovery', ['challenge' => $this->challenge()]);
        self::assertSame(429, $this->statusCode());
        self::assertSame(ErrorCode::TooManyAttempts->type(), $this->last()['type']);
        self::assertNotNull($this->client->getResponse()->headers->get('Retry-After'));
    }

    #[Test]
    public function theStartScreenPicksUpARequestThatIsStillOpen(): void
    {
        $this->start();
        $opening = $this->call('POST', '/api/auth/two-factor/recovery/opening', ['challenge' => $this->challenge()]);

        self::assertIsString($opening['recovery']);
        self::assertSame('proving', Type\shape(['status' => Type\string()], true)->coerce($opening['state'])['status']);
        self::assertSame('proving', $this->state(Type\string()->coerce($opening['recovery']))['status']);
    }

    #[Test]
    public function onlyAFirstFactorThatPassedCanAsk(): void
    {
        $this->call('POST', '/api/auth/two-factor/recovery/opening', ['challenge' => 'not-a-challenge']);
        self::assertSame(ErrorCode::TwoFactorChallengeInvalid->type(), $this->last()['type']);
        $this->call('POST', '/api/auth/two-factor/recovery/state', ['recovery' => 'not-a-handle']);
        self::assertSame(ErrorCode::RecoveryRequestInvalid->type(), $this->last()['type']);
    }

    private function proved(): string
    {
        $handle = $this->start();
        self::assertSame('waiting', $this->prove($handle, $this->emailCode())['status']);

        return $handle;
    }

    private function start(): string
    {
        $started = $this->call('POST', '/api/auth/two-factor/recovery', ['challenge' => $this->challenge()]);
        self::assertSame(201, $this->statusCode(), Json\encode($started));

        return Type\string()->coerce($started['recovery']);
    }

    /** @return array<string, mixed> */
    private function prove(string $handle, #[SensitiveParameter] string $emailCode, #[SensitiveParameter] ?string $phoneCode = null): array
    {
        $body = $this->call('POST', '/api/auth/two-factor/recovery/prove', ['recovery' => $handle, 'emailCode' => $emailCode, ...(null === $phoneCode ? [] : ['phoneCode' => $phoneCode])]);

        return Type\dict(Type\string(), Type\mixed())->coerce($body['state'] ?? []);
    }

    /** @return array<string, mixed> */
    private function state(string $handle): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($this->call('POST', '/api/auth/two-factor/recovery/state', ['recovery' => $handle])['state'] ?? []);
    }

    private function requestId(): string
    {
        self::em()->clear();
        $recovery = self::em()->getRepository(TwoFactorRecovery::class)->findOneBy([], ['createdAt' => 'DESC']);

        return Type\instance_of(TwoFactorRecovery::class)->coerce($recovery)->getId()->toRfc4122();
    }

    /** @return array<string, mixed> */
    private function asApprover(string $method, string $path): array
    {
        $this->authenticatedAs($this->approver);
        $answer = $this->call($method, $path);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');

        return $answer;
    }

    private function challenge(): string
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $body = $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::PASSWORD]);
        self::assertSame(202, $this->statusCode(), Json\encode($body));

        return Type\string()->coerce($body['twoFactorChallenge']);
    }

    private function turnOnTwoFactor(): void
    {
        $this->authenticatedAs($this->person);
        $secret = Type\non_empty_string()->coerce($this->call('POST', '/api/auth/two-factor/enrol')['secret']);
        $this->call('POST', '/api/auth/two-factor/activate', ['code' => TOTP::createFromSecret($secret)->at(Type\uint()->coerce(new Clock()->now()->getTimestamp()))]);
        self::assertSame(200, $this->statusCode());
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
    }

    private function verifiedPhone(): void
    {
        $person = $this->fresh($this->person);
        $phone = new PhoneNumber($person, '+2348035550142', true, 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        $person->addPhoneNumber($phone);
        self::em()->persist($phone);
        self::em()->flush();
    }

    /** @return list<string> the ids of the sessions made */
    private function signedInElsewhere(int $count): array
    {
        $ids = [];

        foreach (Vec\range(1, $count) as $_) {
            self::service(TokenIssuer::class)->issueFor($this->fresh($this->person));
        }

        self::em()->flush();

        foreach (self::em()->getRepository(RefreshToken::class)->findBy(['user' => $this->person]) as $token) {
            $ids[] = $token->getId()->toRfc4122();
        }

        return $ids;
    }

    /** @return list<string> */
    private function revoked(): array
    {
        self::em()->clear();

        $sessions = self::em()->getRepository(RefreshToken::class)->findBy(['user' => $this->person]);
        $ended = Vec\filter($sessions, static fn (RefreshToken $session): bool => null !== $session->getRevokedAt());

        return Vec\map($ended, static fn (RefreshToken $session): string => $session->getId()->toRfc4122());
    }

    /** @return list<string> */
    private function audited(): array
    {
        return Vec\map(
            self::em()->getRepository(AuditEntry::class)->findBy(['subjectType' => 'two_factor_recovery'], ['occurredAt' => 'ASC']),
            static fn (AuditEntry $entry): string => $entry->action(),
        );
    }

    private function emailCode(): string
    {
        $mail = Iter\last($this->mailsTo(self::ADDRESS, 'Your code to get back into Soirely')) ?? self::fail('no code was emailed');

        return Regex\first_match($mail, '/^(\d{6})$/m')[1] ?? self::fail('the email carries no code');
    }

    private function textedCode(): string
    {
        $text = Iter\last(self::service(RecordingTextMessageSender::class)->sent) ?? self::fail('nothing was texted');

        return Regex\first_match($text['body'], '/(\d{6})/')[1] ?? self::fail('the text carries no code');
    }

    private function mailTo(string $address, string $subject): string
    {
        return Iter\last($this->mailsTo($address, $subject)) ?? self::fail('no "' . $subject . '" to ' . $address);
    }

    /** @return list<string> the bodies */
    private function mailsTo(string $address, string $subject): array
    {
        $mails = Vec\filter(
            Type\vec(Type\instance_of(Email::class))->coerce(self::getMailerMessages()),
            static fn (Email $mail): bool => $mail->getSubject() === $subject && Iter\any($mail->getTo(), static fn ($to): bool => $to->getAddress() === $address),
        );

        return Vec\map($mails, static fn (Email $mail): string => Type\string()->coerce($mail->getTextBody()));
    }

    /** @return list<string> */
    private function headingsTo(string $address, string $subject): array
    {
        return Vec\map($this->mailsTo($address, $subject), static fn (string $body): string => Str\split($body, "\n\n")[0]);
    }

    /** @return list<string> */
    private function violatedFields(): array
    {
        return Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($this->last()['violations'] ?? []),
            static fn (array $violation): string => $violation['propertyPath'],
        );
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        $user->markDetailsSaved();
        self::em()->flush();

        return $user;
    }

    private function join(User $user, SeededRole $as): void
    {
        $organisation = Type\instance_of(Organisation::class)->coerce(self::em()->find(Organisation::class, $this->organisation->getId()));
        $role = Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]));
        self::em()->persist(new Membership($organisation, $this->fresh($user), $role, MembershipStatus::Active));
    }

    private function leaves(User $user): void
    {
        self::em()->remove(Type\instance_of(Membership::class)->coerce(self::em()->getRepository(Membership::class)->findOneBy(['user' => $user])));
        self::em()->flush();
    }

    private function fresh(User $user): User
    {
        return Type\instance_of(User::class)->coerce(self::em()->find(User::class, $user->getId()));
    }

    private function authenticatedAs(User $user): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh($user)));
    }

    private function bootCommand(string $name): void
    {
        $application = new Application(self::$kernel ?? self::fail('no kernel'));
        $tester = new CommandTester($application->find($name));
        $tester->execute([]);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($body ?? new stdClass()));

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

    private static function wrongOf(string $code): string
    {
        return '000000' === $code ? '111111' : '000000';
    }
}
