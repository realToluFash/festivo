<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Domain\User\Mail\UserMailer;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use DateInterval;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Not urgent: a verification code must not wait behind a million of these (sc-18317). */
final readonly class SignInRulesNotice implements NotificationTypeInterface
{
    public const string NAME = 'sign_in_rules.notice';

    public const string CHANGED = 'changed';

    /** Only to those without two-factor, when it was required alongside another change. */
    public const string DUE = 'due';

    /** To the other Owners, when one signs in around required sign-on (sc-610). */
    public const string BREAK_GLASS = 'break_glass';

    public function __construct(
        private SignInRulesMailer $signInRulesMailer,
        private SignInRules $signInRules,
        private UserMailer $userMailer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * @param array<string, array{0: mixed, 1: mixed}> $changes rule => [before, after]
     *
     * @return array<string, mixed>
     */
    public static function payload(string $email, Organisation $organisation, User $by, array $changes, DateTimeImmutable $at, ?string $asked): array
    {
        return [
            'email' => $email,
            'organisation' => $organisation->getName(),
            'organisationId' => $organisation->getId()->toRfc4122(),
            'by' => ['id' => $by->getId()->toRfc4122(), 'name' => $by->getName()],
            'changes' => $changes,
            'at' => $at->format(\DATE_ATOM),
            'asked' => $asked,
        ];
    }

    /** @return array<string, mixed> */
    public static function breakGlass(Organisation $organisation, User $by, string $provider, string $method, DateTimeImmutable $at, ?string $asked): array
    {
        return [
            ...self::payload(self::BREAK_GLASS, $organisation, $by, [], $at, $asked),
            'provider' => $provider,
            'method' => $method,
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
        return NotificationCategory::AccountSecurity;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Info;
    }

    public function channels(): array
    {
        return [NotificationChannel::Email];
    }

    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::Automatic;
    }

    public function canBeSwitchedOff(): bool
    {
        return false;
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
        if (null === $recipient || self::DUE !== self::shape($payload)['email']) {
            return true;
        }

        $member = $this->entityManager->find(User::class, $recipient);

        return null !== $member && $this->signInRules->owesTwoFactor($member, Uuid::fromString(self::shape($payload)['organisationId']));
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $notice = self::shape($payloads[0]);
        $member = $this->entityManager->find(User::class, $recipient->id) ?? throw new LogicException('A recipient is an account.');
        $at = new DateTimeImmutable($notice['at']);

        if (self::BREAK_GLASS === $notice['email']) {
            return $this->signInRulesMailer->breakGlass(
                $member,
                $recipient->locale,
                $notice['organisation'],
                $notice['by']['name'],
                $notice['provider'] ?? '',
                $notice['method'] ?? '',
                $at,
            );
        }

        $changes = $notice['changes'];
        $twoFactorRequired = true === ($changes['everyoneNeedsTwoFactor'][1] ?? null);
        $toldOnce = $twoFactorRequired && ['everyoneNeedsTwoFactor'] === Vec\keys($changes);

        if (self::DUE === $notice['email'] || ($toldOnce && $this->signInRules->owesTwoFactor($member, Uuid::fromString($notice['organisationId'])))) {
            return $this->signInRulesMailer->twoFactorDue(
                $member,
                $recipient->locale,
                $recipient->emailAddress ?? '',
                $notice['organisation'],
                $at->add(new DateInterval(SignInRules::TWO_FACTOR_GRACE)),
            );
        }

        $isActor = $member->getId()->toRfc4122() === $notice['by']['id'];

        return $this->signInRulesMailer->changed(
            $member,
            $isActor ? $this->userMailer->localeFor($member, $notice['asked']) : $recipient->locale,
            $notice['organisation'],
            $notice['by']['name'],
            $changes,
            true === ($changes['providerOnly'][1] ?? null) && !$this->signInRules->isLinked($member),
            $at,
        );
    }

    /**
     * @param array<string, mixed> $payload
     *
     * @return array{email: string, organisation: string, organisationId: string, by: array{id: string, name: string}, changes: array<string, array{0: mixed, 1: mixed}>, at: string, asked: ?string, provider?: string, method?: string}
     */
    private static function shape(array $payload): array
    {
        return Type\shape([
            'email' => Type\string(),
            'organisation' => Type\string(),
            'organisationId' => Type\string(),
            'by' => Type\shape(['id' => Type\string(), 'name' => Type\string()]),
            'changes' => Type\dict(Type\string(), Type\shape([0 => Type\mixed(), 1 => Type\mixed()])),
            'at' => Type\string(),
            'asked' => Type\nullable(Type\string()),
            'provider' => Type\optional(Type\string()),
            'method' => Type\optional(Type\string()),
        ])->coerce($payload);
    }
}
