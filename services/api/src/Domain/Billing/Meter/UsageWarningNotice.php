<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\Organisation;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use App\Enum\UsageKind;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use NumberFormatter;
use Psl\Dict;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The 80% or 100% warning on an included amount (sc-3931): a Money item in the bell and an email, to everyone who can read the organisation's billing. */
final readonly class UsageWarningNotice implements NotificationTypeInterface
{
    public const string NAME = 'billing.usage_warning';

    /** @var non-empty-list<array{string, int}> decimal, largest first */
    private const array UNITS = [['terabyte', 1_000_000_000_000], ['gigabyte', 1_000_000_000], ['megabyte', 1_000_000]];

    public function __construct(
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** @return array<string, mixed> */
    public static function payload(Uuid $organisationId, UsageKind $kind, int $threshold, int $used, int $included, DateTimeImmutable $periodEnd, int $draftCost): array
    {
        return [
            'organisationId' => $organisationId->toRfc4122(),
            'kind' => $kind->value,
            'threshold' => $threshold,
            'used' => $used,
            'included' => $included,
            'resetsAt' => $periodEnd->format(\DATE_ATOM),
            'draftCost' => $draftCost,
        ];
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Member;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::Money;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Normal;
    }

    public function channels(): array
    {
        return [NotificationChannel::InApp, NotificationChannel::Email];
    }

    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::Automatic;
    }

    public function canBeSwitchedOff(): bool
    {
        return true;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function carriesCode(): bool
    {
        return false;
    }

    public function supersedesEarlier(): bool
    {
        return false;
    }

    public function reachesSuppressed(): bool
    {
        return false;
    }

    public function collapseKey(array $payload): ?string
    {
        return null;
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null !== $this->organisation(self::shape($payload)['organisationId']);
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $warning = self::shape($payloads[0]);
        $locale = $recipient->locale;
        $organisation = $this->organisation($warning['organisationId']);
        $name = $organisation?->getName() ?? '';
        $drafts = UsageKind::AiRequest->value === $warning['kind'];
        $all = 100 <= $warning['threshold'];
        $what = $drafts ? 'drafts' : 'storage';

        $title = $this->trans(Str\format('usage_warning.%s.heading_%s', $what, $all ? 'all' : 'part'), ['organisation' => $name, 'percent' => self::percent($warning['threshold'], $locale)], $locale);

        $lines = $drafts
            ? [
                $this->trans('usage.assistant_drafts_row', ['used' => $warning['used'], 'included' => $warning['included']], $locale),
                $this->trans($all ? 'usage_warning.drafts.next_all' : 'usage_warning.drafts.next_part', ['count' => $warning['draftCost']], $locale),
                $this->trans('usage_warning.drafts.reset', ['date' => self::day(new DateTimeImmutable($warning['resetsAt']), $organisation?->getTimezone() ?? 'UTC', $locale)], $locale),
            ]
            : [
                $this->trans('usage.storage_row', ['used' => $this->size($warning['used'], $locale), 'included' => $this->size($warning['included'], $locale)], $locale),
                $this->trans('usage_warning.storage.next', [], $locale),
            ];

        if (NotificationChannel::Email === $channel) {
            return new RenderedNotification($title, Str\join([$title, '', ...$lines], "\n"));
        }

        return new RenderedNotification($title, Str\join($lines, "\n"), $lines);
    }

    /** In the largest of MB, GB and TB in which it is at least 1 (MB below 1 MB), at most one decimal, rounded down: a size never reads as the included amount before it is reached. */
    private function size(int $bytes, string $locale): string
    {
        [$unit, $per] = self::UNITS[2];

        foreach (self::UNITS as [$candidate, $candidatePer]) {
            if ($bytes >= $candidatePer) {
                [$unit, $per] = [$candidate, $candidatePer];

                break;
            }
        }

        $formatter = new NumberFormatter(SupportedLocales::dates($locale), NumberFormatter::DECIMAL);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, 1);
        $number = $formatter->format(Math\div($bytes * 10, $per) / 10);

        return $this->trans('usage.size.' . $unit, ['size' => false === $number ? '' : $number], $locale);
    }

    private static function percent(int $threshold, string $locale): string
    {
        $formatted = new NumberFormatter(SupportedLocales::dates($locale), NumberFormatter::PERCENT)->format($threshold / 100);

        return false === $formatted ? $threshold . '%' : $formatted;
    }

    /** Day and long month in the organisation's time zone, with no weekday and no time, as Usage this period's range shows it. */
    private static function day(DateTimeImmutable $at, string $timezone, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('dMMMM');
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $timezone, null, false === $pattern ? 'd MMMM' : $pattern);

        return $formatter?->format($at) ?: $at->format('Y-m-d');
    }

    private function organisation(string $id): ?Organisation
    {
        return Uuid::isValid($id) ? $this->entityManager->find(Organisation::class, Uuid::fromString($id)) : null;
    }

    /** @param array<string, mixed> $parameters */
    private function trans(string $key, array $parameters, string $locale): string
    {
        return $this->translator->trans($key, $parameters, 'messages', $locale);
    }

    /**
     * @param array<string, mixed> $payload
     *
     * @return array{organisationId: string, kind: string, threshold: int, used: int, included: int, resetsAt: string, draftCost: int}
     */
    private static function shape(array $payload): array
    {
        return Type\shape([
            'organisationId' => Type\string(),
            'kind' => Type\string(),
            'threshold' => Type\int(),
            'used' => Type\int(),
            'included' => Type\int(),
            'resetsAt' => Type\string(),
            'draftCost' => Type\int(),
        ])->coerce(Dict\select_keys($payload, ['organisationId', 'kind', 'threshold', 'used', 'included', 'resetsAt', 'draftCost']));
    }
}
