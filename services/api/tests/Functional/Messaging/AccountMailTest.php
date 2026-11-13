<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\EmailSuppressions;
use App\Domain\Messaging\MailDeliveryRates;
use App\Domain\Messaging\NotificationRegistry;
use App\Domain\Organisation\Deletion\OrganisationDeleter;
use App\Domain\User\Mail\MailCode;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\Registration\PendingRegistrations;
use App\Enum\AccountMail;
use App\Enum\MailProviderReport;
use App\Enum\NotificationPriority;
use App\Enum\SeededRole;
use Doctrine\DBAL\Exception\CheckConstraintViolationException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;
use Psl\Vec;
use Psr\Log\AbstractLogger;
use Stringable;
use Symfony\Component\Clock\NativeClock;

final class AccountMailTest extends MessagingTestCase
{
    #[Test]
    public function everyAccountMailIsARegisteredUrgentTypeThatCannotBeSwitchedOff(): void
    {
        $registry = self::service(NotificationRegistry::class);

        foreach (AccountMail::cases() as $mail) {
            $type = $registry->type($mail->typeName());
            self::assertSame(NotificationPriority::Urgent, $type->priority(), $mail->value);
            self::assertFalse($type->canBeSwitchedOff(), $mail->value);
        }
    }

    #[Test]
    public function aMailIsQueuedWithItsWordsAndSentOnlyByTheWorker(): void
    {
        self::queue(AccountMail::NewDevice, 'ada@example.test', 'fr', 'newDevice.subject', ['First.', 'Second.']);

        self::assertSame([], self::sender()->sent, 'nothing goes from the request');
        self::assertSame('pending', self::scalar("SELECT status FROM notification_deliveries WHERE type = 'mail.new_device'"));
        self::assertSame(NotificationPriority::Urgent->value, Type\int()->coerce(self::scalar("SELECT priority FROM notification_deliveries WHERE type = 'mail.new_device'")));

        self::runUntilIdle();

        self::assertCount(1, self::sender()->sent);
        $sent = self::sender()->sent[0];
        self::assertSame('ada@example.test', $sent['recipient']->emailAddress);
        self::assertSame("First.\n\nSecond.", $sent['notification']->body);
        self::assertSame(self::mailer()->line('newDevice.subject', 'fr'), $sent['notification']->subject, 'in the language chosen when it was queued');
        self::assertSame('sent', self::scalar("SELECT status FROM notification_deliveries WHERE type = 'mail.new_device'"));
    }

    #[Test]
    public function theDeletionEmailReachesEveryMemberActiveAtTheDeleteThoughTheOrganisationHasGone(): void
    {
        $this->member('admin', SeededRole::Admin);
        $this->member('plain', SeededRole::Member);

        self::service(OrganisationDeleter::class)->delete($this->organisation, $this->owner, $this->organisation->getName());
        self::em()->flush();
        self::runUntilIdle();

        self::assertSame(3, self::rowCount("SELECT COUNT(*) FROM notification_deliveries WHERE type = 'mail.organisation_deleted' AND status = 'sent'"));
        self::assertCount(3, self::sender()->sent);
    }

    #[Test]
    public function aSendThatKeepsFailingIsRecordedFailedWithTheProvidersReasonAfterFiveAttempts(): void
    {
        self::sender()->failuresLeft = 5;
        self::queue(AccountMail::Ownership, 'kemi@example.test', 'en', 'ownershipTransferred.subject', ['Body.']);

        for ($attempt = 1; $attempt <= 5; ++$attempt) {
            self::runUntilIdle();
            self::connection()->executeStatement("UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '2 seconds' WHERE status = 'pending'");
        }

        self::assertSame(5, self::sender()->calls);
        self::assertSame('failed', self::scalar('SELECT status FROM notification_deliveries'));
        self::assertStringContainsString('550 the provider said no', Type\string()->coerce(self::scalar('SELECT last_error FROM notification_deliveries')));
    }

    #[Test]
    public function aCodeIsNeverRetriedPastItsExpiry(): void
    {
        self::sender()->failuresLeft = 1;
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['123456'], code: new MailCode('123456', 10));

        self::runUntilIdle();
        self::assertSame('pending', self::scalar('SELECT status FROM notification_deliveries'), 'the first attempt failed and waits for its retry');

        self::connection()->executeStatement("UPDATE notification_deliveries SET send_by = NOW() - INTERVAL '1 second', next_attempt_at = NOW() - INTERVAL '1 second'");
        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame('failed', self::scalar('SELECT status FROM notification_deliveries'));
        self::assertSame('code expired', self::scalar('SELECT last_error FROM notification_deliveries'));
    }

    #[Test]
    public function aNewerCodeSupersedesTheOneNotYetSentAndAResendIsANewSend(): void
    {
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['111111'], code: new MailCode('111111', 10));
        self::queue(AccountMail::VerificationCode, 'Ada@Example.test', 'en', 'verification.subject', ['222222'], code: new MailCode('222222', 10));

        self::assertSame(['superseded', 'pending'], self::statuses());

        self::runUntilIdle();
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['333333'], code: new MailCode('333333', 10));
        self::runUntilIdle();

        self::assertSame(['superseded', 'sent', 'sent'], self::statuses(), 'a sent code is not superseded, and the resend goes');
        self::assertSame(['222222', '333333'], Vec\map(self::sender()->sent, static fn (array $sent): string => $sent['notification']->body));
    }

    #[Test]
    public function theSameSendQueuedTwiceGoesOnce(): void
    {
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['123456'], code: new MailCode('123456', 10));
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['123456'], code: new MailCode('123456', 10));
        self::queue(AccountMail::Invitation, 'kemi@example.test', 'en', 'invitation.subject', ['Join.'], source: 'invitation-1:send-1');
        self::queue(AccountMail::Invitation, 'kemi@example.test', 'en', 'invitation.subject', ['Join.'], source: 'invitation-1:send-1');

        self::runUntilIdle();
        self::runUntilIdle();

        self::assertSame(2, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
        self::assertSame(2, self::rowCount('SELECT COUNT(*) FROM scheduled_notifications'));
        self::assertSame(2, self::sender()->calls);
    }

    #[Test]
    public function aSuppressedAddressGetsSecurityMailOnlyAndTheRestIsCancelled(): void
    {
        self::service(EmailSuppressions::class)->suppress('Ada@Example.test', MailProviderReport::Bounced);

        self::queue(AccountMail::Ownership, 'ada@example.test', 'en', 'ownershipTransferred.subject', ['Ownership.']);
        self::queue(AccountMail::NewDevice, 'ada@example.test', 'en', 'newDevice.subject', ['Device.']);
        self::queue(AccountMail::RecoveryLink, 'ada@example.test', 'en', 'recovery.link.subject', ['Link.'], code: new MailCode('token', 60));
        self::runUntilIdle();

        self::assertSame(['Device.', 'Link.'], Vec\map(self::sender()->sent, static fn (array $sent): string => $sent['notification']->body));
        self::assertSame(
            ['cancelled', 'address suppressed'],
            Vec\values(Type\dict(Type\string(), Type\string())->coerce(self::connection()->fetchAssociative("SELECT status, last_error FROM notification_deliveries WHERE type = 'mail.ownership'"))),
            'never Failed: a suppressed address is the system working',
        );
    }

    #[Test]
    public function theRateCheckWritesACriticalLineOnlyOverEachThreshold(): void
    {
        $logged = self::rates(sent: 1000, bounced: 20, complained: 0);
        self::assertSame([], $logged, '2% is not over 2%');

        $logged = self::rates(sent: 1000, bounced: 21, complained: 0);
        self::assertCount(1, $logged);
        self::assertStringContainsString('bounces are at 2.10%', $logged[0]);
        self::assertStringContainsString('2.00% threshold', $logged[0]);

        $logged = self::rates(sent: 10000, bounced: 0, complained: 8);
        self::assertSame([], $logged, '0.08% is not over 0.08%');

        $logged = self::rates(sent: 10000, bounced: 0, complained: 9);
        self::assertCount(1, $logged);
        self::assertStringContainsString('complaints are at 0.09%', $logged[0]);
        self::assertStringContainsString('0.08% threshold', $logged[0]);
    }

    #[Test]
    public function aSendOutsideATransactionIsRefused(): void
    {
        $this->expectExceptionMessage('is written in the transaction of the change it tells of');

        self::mailer()->send(AccountMail::NewDevice, 'ada@example.test', 'en', 'newDevice.subject', ['Device.']);
    }

    #[Test]
    public function aChangeWhoseEmailCannotBeQueuedIsRolledBack(): void
    {
        self::connection()->executeStatement("ALTER TABLE scheduled_notifications ADD CONSTRAINT refuse_deletion_mail CHECK (type <> 'mail.organisation_deleted')");

        try {
            self::service(OrganisationDeleter::class)->delete($this->organisation, $this->owner, $this->organisation->getName());
            self::fail('the queue write was refused');
        } catch (CheckConstraintViolationException) {
        }

        self::assertNull(self::scalar('SELECT deleted_at FROM organisations WHERE id = :id', ['id' => $this->organisation->getId()->toRfc4122()]), 'the delete went back with its email');
        self::assertSame(0, self::rowCount("SELECT COUNT(*) FROM audit_entries WHERE action = 'organisation.deleted'"));
    }

    #[Test]
    public function aSignUpForATakenAddressWritesWhatAFreshOneDoes(): void
    {
        $taken = Type\string()->coerce($this->owner->getPrimaryEmailAddress()?->getAddress());
        $registrations = self::service(PendingRegistrations::class);
        $writes = [];

        foreach (['fresh' => 'new.person@example.test', 'taken' => $taken] as $path => $address) {
            foreach ([1, 2] as $attempt) {
                $before = self::writes();
                $registrations->start($address, 'Ada', 'correct horse battery staple', 'en');
                $writes[$path][] = Vec\map(self::writes(), static fn (int $count, int $i): int => $count - $before[$i]);
            }
        }

        self::assertSame($writes['fresh'], $writes['taken']);
        self::assertSame([[1, 1, 0], [1, 1, 1]], $writes['fresh'], 'each queues one, and the second supersedes the first');
    }

    #[Test]
    public function theAlreadyRegisteredEmailGoesOnceAnHourAndTheRestAreRecordedCancelled(): void
    {
        self::queue(AccountMail::AlreadyRegistered, 'ada@example.test', 'en', 'alreadyRegistered.subject', ['You have an account.']);
        self::runUntilIdle();
        self::queue(AccountMail::AlreadyRegistered, 'ada@example.test', 'en', 'alreadyRegistered.subject', ['You have an account.']);
        self::runUntilIdle();

        self::assertSame(['sent', 'cancelled'], self::statuses());
        self::assertSame('no longer due', self::scalar("SELECT last_error FROM notification_deliveries WHERE status = 'cancelled'"));

        self::connection()->executeStatement("UPDATE notification_deliveries SET finished_at = finished_at - INTERVAL '61 minutes'");
        self::queue(AccountMail::AlreadyRegistered, 'ada@example.test', 'en', 'alreadyRegistered.subject', ['You have an account.']);
        self::runUntilIdle();

        self::assertSame(['sent', 'cancelled', 'sent'], self::statuses());
        self::assertSame(2, self::sender()->calls);
    }

    #[Test]
    public function aCodesWordsAreClearedOnceItsSendIsOver(): void
    {
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['111111'], code: new MailCode('111111', 10));
        self::queue(AccountMail::VerificationCode, 'ada@example.test', 'en', 'verification.subject', ['222222'], code: new MailCode('222222', 10));
        self::queue(AccountMail::RecoveryLink, 'kemi@example.test', 'en', 'recovery.link.subject', ['https://example.test/reset/token'], code: new MailCode('token', 60));
        self::queue(AccountMail::NewDevice, 'ada@example.test', 'en', 'newDevice.subject', ['Device.']);

        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE payload::text LIKE '%222222%'"), 'kept while it waits');
        self::assertSame(0, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE payload::text LIKE '%111111%'"), 'a superseded code goes at once');

        self::runUntilIdle();

        self::assertSame(0, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE payload::text LIKE '%222222%' OR payload::text LIKE '%token%'"));
        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE payload::text LIKE '%Device.%'"), 'mail with no code keeps its words');
    }

    /** @param mixed ...$arguments UserMailer::send's, named as it names them */
    private static function queue(mixed ...$arguments): void
    {
        self::connection()->transactional(static fn () => self::mailer()->send(...$arguments));
    }

    /** @return list<int> scheduled rows, delivery rows and superseded deliveries */
    private static function writes(): array
    {
        return [
            self::rowCount('SELECT COUNT(*) FROM scheduled_notifications'),
            self::rowCount('SELECT COUNT(*) FROM notification_deliveries'),
            self::rowCount("SELECT COUNT(*) FROM notification_deliveries WHERE status = 'superseded'"),
        ];
    }

    private static function mailer(): UserMailer
    {
        return self::service(UserMailer::class);
    }

    /** @return list<string> */
    private static function statuses(): array
    {
        return Vec\map(self::connection()->fetchFirstColumn('SELECT status FROM notification_deliveries ORDER BY created_at, id'), Type\string()->coerce(...));
    }

    /** @return list<string> the critical lines, for that many sends in the last day */
    private static function rates(int $sent, int $bounced, int $complained): array
    {
        self::connection()->executeStatement('DELETE FROM notification_deliveries');
        self::connection()->executeStatement('DELETE FROM scheduled_notifications');
        self::connection()->executeStatement(
            <<<'SQL'
                WITH s AS (
                    INSERT INTO scheduled_notifications (id, type, cancellation_key, source_id, trigger, due_at, audience, payload, priority, status, created_at)
                    VALUES (gen_random_uuid(), 'mail.new_device', 'k', 's', '{}', NOW(), '{}', '{}', 0, 'fanned_out', NOW())
                    RETURNING id
                )
                INSERT INTO notification_deliveries (
                    id, scheduled_notification_id, type, source_id, recipient_kind, recipient_id, channel, priority, status,
                    due_at, next_attempt_at, attempts, created_at, finished_at, provider_report
                )
                SELECT gen_random_uuid(), s.id, 'mail.new_device', 'source-' || n, 'person', gen_random_uuid(), 'email', 0, 'sent',
                       NOW(), NOW(), 1, NOW(), NOW() - INTERVAL '1 hour',
                       CASE WHEN n <= CAST(:bounced AS INT) THEN 'bounced' WHEN n <= CAST(:bounced AS INT) + CAST(:complained AS INT) THEN 'complained' END
                FROM s, generate_series(1, CAST(:sent AS INT)) AS n
                SQL,
            ['sent' => $sent, 'bounced' => $bounced, 'complained' => $complained],
        );

        $logger = new class extends AbstractLogger {
            /** @var list<string> */
            public array $critical = [];

            public function log($level, string|Stringable $message, array $context = []): void
            {
                if ('critical' === $level) {
                    $this->critical[] = (string) $message;
                }
            }
        };
        new MailDeliveryRates(self::connection(), new NativeClock(), $logger)->check();

        return $logger->critical;
    }
}
