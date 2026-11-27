<?php

declare(strict_types=1);

namespace App\Tests\Functional\Billing;

use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Billing\Entitlements;
use App\Domain\Billing\Meter\Model\MeteredUse;
use App\Domain\Billing\Meter\UsageMeter;
use App\Domain\Billing\Meter\UsageWarningNotice;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\UsageRecord;
use App\Enum\CataloguePart;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\Permission;
use App\Enum\UsageKind;
use App\Repository\CatalogueVersionRepository;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** sc-3931: 80% and 100% of an included amount warn the people who can read billing, once each per period and kind, and storage is never refused or charged. */
final class UsageWarningTest extends FunctionalTestCase
{
    use ClockSensitiveTrait;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string PERIOD_START = '2026-11-01 09:00:00';

    private const int GB = 1_000_000_000;

    private Uuid $organisation;

    private Uuid $owner;

    protected function setUp(): void
    {
        parent::setUp();
        self::mockTime(new DateTimeImmutable('2026-11-24T10:00:00+00:00'));
        [$this->owner, $this->organisation] = $this->found();
    }

    #[Test]
    public function noWarningGoesBelowEightyPercentOfTheIncludedDrafts(): void
    {
        $this->drafts(3);

        self::assertSame([], $this->warnings());
    }

    #[Test]
    public function eightyAndOneHundredPercentOfTheIncludedDraftsEachWarnOnceAndNothingAfter(): void
    {
        $this->credit(1000);
        $this->drafts(4);
        self::assertSame([['ai_request', 80, 4]], $this->warnings());

        $this->drafts(1);
        self::assertSame([['ai_request', 80, 4], ['ai_request', 100, 5]], $this->warnings());

        $this->drafts(2);
        self::assertSame([['ai_request', 80, 4], ['ai_request', 100, 5]], $this->warnings());
    }

    #[Test]
    public function twoDraftsHeldTogetherThatBothPassEightyPercentWarnOnce(): void
    {
        $this->includeDrafts(10);
        $this->drafts(7);
        $first = $this->meter()->reserve($this->organisation, new MeteredUse(UsageKind::AiRequest));
        $second = $this->meter()->reserve($this->organisation, new MeteredUse(UsageKind::AiRequest));

        $this->meter()->settle($second->reservationId, 'draft-b', new MeteredUse(UsageKind::AiRequest));
        $this->meter()->settle($first->reservationId, 'draft-a', new MeteredUse(UsageKind::AiRequest));

        self::assertSame([['ai_request', 80, 8]], $this->warnings());
    }

    #[Test]
    public function aNewPeriodWarnsTheDraftsAgainFromNothing(): void
    {
        $this->drafts(4);
        self::mockTime(new DateTimeImmutable('2026-12-02T10:00:00+00:00'));
        $this->drafts(3);
        self::assertCount(1, $this->warnings());

        $this->drafts(1);
        self::assertSame([['ai_request', 80, 4], ['ai_request', 80, 4]], $this->warnings());
    }

    #[Test]
    public function questionsAndMessagesNeverWarn(): void
    {
        $this->meter()->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email, 2400));

        self::assertSame([], $this->warnings());
    }

    #[Test]
    public function storageWarnsOnceAtEachThresholdAndAJumpPastBothSendsOnlyTheHigher(): void
    {
        $this->measure((int) (1.7 * self::GB));
        $this->measure((int) (1.8 * self::GB));
        self::assertSame([['storage_bytes', 80, (int) (1.7 * self::GB)]], $this->warnings());

        [, $other] = $this->found('ada@okafor.family', 'Okafor Family');
        $this->measure(2 * self::GB, $other);
        self::assertSame([['storage_bytes', 100, 2 * self::GB]], $this->warnings($other));
    }

    #[Test]
    public function storageAlreadyAboveEightyPercentWhenAPeriodStartsIsNotWarnedAgain(): void
    {
        $this->measure((int) (1.7 * self::GB));
        self::mockTime(new DateTimeImmutable('2026-12-02T10:00:00+00:00'));
        $this->measure((int) (1.75 * self::GB));

        self::assertCount(1, $this->warnings());
    }

    #[Test]
    public function storageThatFallsBelowAndRisesPastAgainInALaterPeriodIsWarnedAgain(): void
    {
        $this->measure((int) (1.7 * self::GB));
        $this->measure(self::GB);
        $this->measure((int) (1.7 * self::GB));
        self::assertCount(1, $this->warnings(), 'at most once per period');

        self::mockTime(new DateTimeImmutable('2026-12-02T10:00:00+00:00'));
        $this->measure(self::GB);
        $this->measure((int) (1.8 * self::GB));

        self::assertSame([['storage_bytes', 80, (int) (1.7 * self::GB)], ['storage_bytes', 80, (int) (1.8 * self::GB)]], $this->warnings());
    }

    #[Test]
    public function storageAboveTwiceItsIncludedAmountAlertsSupportOnceAndIsNeverCharged(): void
    {
        $record = $this->measure(5 * self::GB);
        $this->measure(6 * self::GB);

        self::assertSame(0, $record->getCreditsTaken());
        self::assertSame([['storage_bytes', 100, 5 * self::GB]], $this->warnings());
        self::assertSame(0, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT credits_taken FROM usage_totals WHERE organisation_id = ? AND kind = ?', [$this->organisation->toRfc4122(), 'storage_bytes'])));
        self::assertSame(1, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT count(*) FROM usage_warnings WHERE organisation_id = ? AND threshold = 200 AND warned_period_start IS NOT NULL', [$this->organisation->toRfc4122()])));
    }

    #[Test]
    public function aWarningGoesToThePeopleWhoCanReadBillingInTheBellAndByEmail(): void
    {
        $this->drafts(4);
        $row = Type\shape(['type' => Type\string(), 'audience' => Type\string(), 'event_id' => Type\nullable(Type\string())], true)->coerce(self::em()->getConnection()->fetchAssociative("SELECT type, audience, event_id FROM scheduled_notifications WHERE type = 'billing.usage_warning'"));
        $notice = self::service(UsageWarningNotice::class);

        self::assertNull($row['event_id']);
        self::assertSame(Permission::BillingRead->value, Type\shape(['permission' => Type\string()], true)->coerce(Json\decode($row['audience']))['permission']);
        self::assertSame(NotificationCategory::Money, $notice->category());
        self::assertSame([NotificationChannel::InApp, NotificationChannel::Email], $notice->channels());
    }

    #[Test]
    public function theDraftsItemSaysTheKindUsedOfIncludedWhatHappensNextAndWhenTheyReset(): void
    {
        $item = $this->rendered(NotificationChannel::InApp, 'en', UsageKind::AiRequest, 80, 4, 5);

        self::assertSame('Ìrè Events has used 80% of its included assistant drafts', $item->subject);
        self::assertSame([
            '4 of 5 assistant drafts',
            'After your included assistant drafts, each draft costs 13 credits.',
            'Your included assistant drafts reset on 1 December.',
        ], $item->lines);
        self::assertSame('/app/settings/plan-and-billing?organisation=' . $this->organisation->toRfc4122() . '#usage-this-period', $item->place);

        $all = $this->rendered(NotificationChannel::InApp, 'en', UsageKind::AiRequest, 100, 5, 5);
        self::assertSame('Ìrè Events has used all its included assistant drafts', $all->subject);
        self::assertSame('Each assistant draft now costs 13 credits until your included drafts reset.', $all->lines[1]);
    }

    #[Test]
    public function theStorageItemHasNoResetLineAndItsSizesAreRoundedDown(): void
    {
        $item = $this->rendered(NotificationChannel::InApp, 'en', UsageKind::StorageBytes, 80, 1_990_000_000, 2 * self::GB);

        self::assertSame('Ìrè Events has used 80% of its included storage', $item->subject);
        self::assertSame(['1.9 GB of 2 GB storage', 'Uploads keep working, and nothing is charged.'], $item->lines);

        $small = $this->rendered(NotificationChannel::InApp, 'en', UsageKind::StorageBytes, 100, 2_030_000_000, 2 * self::GB);
        self::assertSame('Ìrè Events has used all its included storage', $small->subject);
        self::assertSame('2 GB of 2 GB storage', $small->lines[0]);
        self::assertSame('900.5 MB of 1 TB storage', $this->rendered(NotificationChannel::InApp, 'en', UsageKind::StorageBytes, 80, 900_590_000, 1_000_000_000_000)->lines[0]);
        self::assertSame('0.5 MB of 2 GB storage', $this->rendered(NotificationChannel::InApp, 'en', UsageKind::StorageBytes, 80, 590_000, 2 * self::GB)->lines[0]);
    }

    #[Test]
    public function thePercentAndTheNumbersAreFormattedInTheRecipientsLanguage(): void
    {
        $item = $this->rendered(NotificationChannel::InApp, 'fr', UsageKind::StorageBytes, 80, 1_640_000_000, 2 * self::GB);

        self::assertMatchesRegularExpression('/ 80\h%/u', $item->subject, 'CLDR puts a no-break space before the sign in French');
        self::assertStringContainsString('1,6', $item->lines[0]);
    }

    #[Test]
    public function theEmailRepeatsTheHeadingThenTheLinesThenOneLinkToPlanAndBillingInThatOrganisation(): void
    {
        $email = $this->rendered(NotificationChannel::Email, 'en', UsageKind::StorageBytes, 100, 2 * self::GB, 2 * self::GB);

        self::assertSame('Ìrè Events has used all its included storage', $email->subject);
        $lines = Str\split($email->body, "\n");
        $link = Vec\reverse($lines)[0] ?? '';

        self::assertSame(['Ìrè Events has used all its included storage', '', '2 GB of 2 GB storage', 'Uploads keep working, and nothing is charged.', ''], Vec\slice($lines, 0, 5));
        self::assertCount(6, $lines);
        self::assertStringStartsWith('Open Plan and billing: http', $link);
        self::assertStringEndsWith('/app/settings/plan-and-billing?organisation=' . $this->organisation->toRfc4122() . '#usage-this-period', $link);
    }

    #[Test]
    public function aDraftWithinTheIncludedDraftsWorksAsBefore(): void
    {
        $this->drafts(2);

        self::assertSame(0, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT credits_taken FROM usage_totals WHERE organisation_id = ? AND kind = ?', [$this->organisation->toRfc4122(), 'ai_request'])));
        self::assertSame(2, Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT used FROM usage_totals WHERE organisation_id = ? AND kind = ?', [$this->organisation->toRfc4122(), 'ai_request'])));
    }

    private function rendered(NotificationChannel $channel, string $locale, UsageKind $kind, int $threshold, int $used, int $included): RenderedNotification
    {
        $payload = UsageWarningNotice::payload($this->organisation, $kind, $threshold, $used, $included, new DateTimeImmutable('2026-12-01T09:00:00+00:00'), 13);

        return self::service(UsageWarningNotice::class)->render($channel, new Recipient(NotificationAudienceKind::Member, $this->owner, 'Folake Adeyemi', $locale, 'folake@ire.events'), [$payload]);
    }

    private function meter(): UsageMeter
    {
        return self::service(UsageMeter::class);
    }

    /** @param int<1, max> $count */
    private function drafts(int $count): void
    {
        for ($i = 0; $i < $count; ++$i) {
            $hold = $this->meter()->reserve($this->organisation, new MeteredUse(UsageKind::AiRequest));
            $this->meter()->settle($hold->reservationId, Uuid::v7()->toRfc4122(), new MeteredUse(UsageKind::AiRequest));
        }
    }

    /** @param int<0, max> $bytes */
    private function measure(int $bytes, ?Uuid $organisation = null): UsageRecord
    {
        return $this->meter()->measureStorage($organisation ?? $this->organisation, new DateTimeImmutable(), $bytes);
    }

    /** @return list<array{string, int, int}> each warning scheduled, oldest first: its kind, threshold and the use it was crossed at */
    private function warnings(?Uuid $organisation = null): array
    {
        $rows = Type\vec(Type\shape(['payload' => Type\string()], true))->coerce(self::em()->getConnection()->fetchAllAssociative(
            "SELECT payload FROM scheduled_notifications WHERE type = 'billing.usage_warning' AND organisation_id = ? ORDER BY created_at, id",
            [($organisation ?? $this->organisation)->toRfc4122()],
        ));

        return Vec\map($rows, static function (array $row): array {
            $payload = Type\shape(['kind' => Type\string(), 'threshold' => Type\int(), 'used' => Type\int()], true)->coerce(Json\decode($row['payload']));

            return [$payload['kind'], $payload['threshold'], $payload['used']];
        });
    }

    private function credit(int $credits): void
    {
        self::em()->getConnection()->executeStatement(
            'UPDATE billing_accounts SET credit_balance = credit_balance + ? WHERE id = (SELECT billing_account_id FROM subscriptions WHERE organisation_id = ?)',
            [$credits, $this->organisation->toRfc4122()],
        );
    }

    private function includeDrafts(int $drafts): void
    {
        $first = self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::Plans, '2026-10-19') ?? self::fail('The first plans version is missing.');
        $terms = Type\dict(Type\string(), Type\dict(Type\string(), Type\mixed()))->coerce($first->getTerms());
        $limits = Type\dict(Type\string(), Type\mixed())->coerce($terms['free']['limits']);
        $limits['ai_requests'] = ['kind' => 'metered', 'amount' => $drafts];
        $terms['free']['limits'] = $limits;
        $keeper = self::service(CatalogueKeeper::class);
        $keeper->moveSubscribers($keeper->publish(CataloguePart::Plans, '2026-11-24', $terms, 'More drafts included, for a test', 'Ada at Soirely'), null, 'More drafts included, for a test', 'Ada at Soirely');
        self::service(Entitlements::class)->forget($this->organisation);
        self::em()->clear();
    }

    /** @return array{Uuid, Uuid} the owner and the organisation */
    private function found(string $email = 'folake@ire.events', string $name = 'Ìrè Events'): array
    {
        $owner = self::service(UserRegistrar::class)->register($email, 'Folake Adeyemi', self::PASSWORD)->user;
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::em()->flush();
        self::em()->getConnection()->executeStatement('UPDATE subscriptions SET period_start = ? WHERE organisation_id = ?', [self::PERIOD_START, $organisation->getId()->toRfc4122()]);
        self::em()->clear();

        return [$owner->getId(), $organisation->getId()];
    }
}
