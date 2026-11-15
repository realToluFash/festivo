<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\User;
use App\Enum\AccountMail;
use App\Locale\SupportedLocales;
use Closure;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Regex;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\AutowireServiceClosure;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A plain-text email to one person, in their locale, from Soirely's one sender: queued on the notification path, never sent from the request (sc-4332). */
final readonly class UserMailer
{
    private const string DOMAIN = 'emails';

    /** Names the address, so every send to it is one person's: a newer code supersedes theirs, and a bounce suppresses it. */
    private const string ADDRESS_NAMESPACE = '6f1d3f0e-3a59-4c1c-9b8e-4b2f0f7c5a11';

    /** @param Closure(): NotificationScheduler $notificationScheduler a closure: the registry's types use this class's dates, and the scheduler needs the registry */
    public function __construct(
        #[AutowireServiceClosure(NotificationScheduler::class)]
        private Closure $notificationScheduler,
        private TranslatorInterface $translator,
        private AccountLanguage $accountLanguage,
        private ClockInterface $clock,
    ) {
    }

    /**
     * Written in the caller's transaction, with the words it will carry; the worker hands it to the provider.
     *
     * @param list<string>          $paragraphs        already in the person's locale, joined by a blank line
     * @param array<string, string> $subjectParameters
     * @param ?string               $source            what it is about, when a second queueing of it must not send again
     */
    public function send(AccountMail $mail, string $address, ?string $locale, string $subjectKey, array $paragraphs, array $subjectParameters = [], ?MailCode $code = null, ?string $source = null): void
    {
        ($this->notificationScheduler)()->scheduleForPerson(
            $mail->typeName(),
            match (true) {
                null !== $source => $source,
                null !== $code => \hash('sha256', $address . "\0" . $code->code),
                default => Uuid::v7()->toRfc4122(),
            },
            Audience::person(self::person($address), $address, $locale ?? SupportedLocales::DEFAULT),
            ['subject' => $this->line($subjectKey, $locale, $subjectParameters), 'body' => Str\join($paragraphs, "\n\n")],
            null === $code ? null : $this->clock->now()->modify(Str\format('+%d minutes', $code->lifetimeMinutes)),
        );
    }

    /** Every send to one address is to one person, whatever account holds it then. */
    public static function person(string $address): Uuid
    {
        return Uuid::v5(Uuid::fromString(self::ADDRESS_NAMESPACE), Str\lowercase(Str\trim($address)));
    }

    /**
     * To the person's primary address, or to nobody when they have none.
     *
     * @param list<string> $paragraphs
     */
    public function sendTo(AccountMail $mail, User $user, string $subjectKey, array $paragraphs, ?string $asked = null, ?MailCode $code = null): void
    {
        $address = $user->getPrimaryEmailAddress()?->getAddress();

        if (null !== $address) {
            $this->send($mail, $address, $this->localeFor($user, $asked), $subjectKey, $paragraphs, code: $code);
        }
    }

    /** The account's own language, or else the one the request that led to this email was made in. */
    public function localeFor(User $user, ?string $asked = null): string
    {
        return $this->accountLanguage->of($user, $asked);
    }

    /** The language a server-written date on a screen is in: the one the request asked for, else the account's (sc-9267). */
    public function shownLocaleFor(User $user): string
    {
        return $this->accountLanguage->shown($user);
    }

    /** The language of a date inside the API's own sentence, which is the sentence's (sc-11329). */
    public function answeredLocale(): string
    {
        return $this->accountLanguage->answered();
    }

    /** A time for a person (sc-868), in the zone and with the label `deadline()` shares: their zone, else UTC, "WAT" or "UTC+04:00". */
    public function moment(DateTimeImmutable $at, User $user, string $locale): string
    {
        [$local, $label] = self::local($at, $user);
        $formatter = IntlDateFormatter::create(SupportedLocales::dates($locale), IntlDateFormatter::LONG, IntlDateFormatter::SHORT, $local->getTimezone()->getName());

        if (null === $formatter) {
            return $local->format('Y-m-d H:i') . ' ' . $label;
        }

        $formatter->setPattern(self::twentyFourHour($formatter->getPattern()));

        return ($formatter->format($local) ?: $local->format('Y-m-d H:i')) . ' ' . $label;
    }

    /** A deadline in the house order for English (sc-6758), not always as the screens write it: "Saturday 24 Oct at 14:20 WAT". */
    public function deadline(DateTimeImmutable $at, User $user, string $locale): string
    {
        [$local, $label] = self::local($at, $user);

        return $this->dateAt($local, $label, $locale);
    }

    /** The same words in UTC, for a `detail` read raw from anywhere (sc-12379): "Monday 26 Oct at 16:32 UTC". */
    public function deadlineInUtc(DateTimeImmutable $at, string $locale): string
    {
        return $this->dateAt($at->setTimezone(new DateTimeZone('UTC')), 'UTC', $locale);
    }

    private function dateAt(DateTimeImmutable $local, string $label, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('EEEEMMMd') ?: 'EEEE d MMM';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, $local->getTimezone()->getName(), null, $pattern);

        return $this->line('time.dateAt', $locale, [
            '{date}' => $formatter?->format($local) ?: $local->format('Y-m-d'),
            '{time}' => $local->format('H:i'),
            '{hour}' => (int) $local->format('G'),
            '{zone}' => $label,
        ]);
    }

    /** @return array{0: DateTimeImmutable, 1: string} the moment in the reader's zone, and the zone as it is labelled */
    private static function local(DateTimeImmutable $at, User $user): array
    {
        $local = $at->setTimezone(new DateTimeZone($user->getTimezone() ?? 'UTC'));
        $abbreviation = $local->format('T');

        return [$local, Regex\matches($abbreviation, '/^[+-]/') ? 'UTC' . $local->format('P') : $abbreviation];
    }

    /**
     * To every verified address the account holds, each in the account's language.
     *
     * @param list<string> $paragraphs
     */
    public function sendToEveryVerified(AccountMail $mail, User $user, string $subjectKey, array $paragraphs): void
    {
        foreach ($user->getEmailAddresses() as $address) {
            if ($address->isVerified()) {
                $this->send($mail, $address->getAddress(), $this->localeFor($user), $subjectKey, $paragraphs);
            }
        }
    }

    /** CLDR's date and wording for the locale, on a 24-hour clock: its short time is 12-hour in en. Quoted text is left alone. */
    private static function twentyFourHour(string $pattern): string
    {
        return Str\trim(Regex\replace_with(
            $pattern,
            '/\'[^\']*\'|[hK]+|[\s\x{00A0}\x{202F}]*a+/u',
            static fn (array $found): string => match (true) {
                Str\starts_with($found[0], "'") => $found[0],
                Regex\matches($found[0], '/^[hK]+$/') => 'HH',
                default => '',
            },
        ));
    }

    /** @param array<string, int|string> $parameters a count is an int, for a catalogue's plural */
    public function line(string $key, ?string $locale, array $parameters = []): string
    {
        return $this->translator->trans($key, $parameters, self::DOMAIN, $locale);
    }

    /** The device as the devices card names its row (sc-55): readable when it can be, else the user agent as it came. */
    public function named(?string $userAgent, string $locale): string
    {
        return $this->agentName($userAgent, $locale) ?? match (true) {
            null === $userAgent || '' === Str\trim($userAgent) => $this->line('password.device.unknown', $locale),
            default => Str\trim($userAgent),
        };
    }

    /** As the devices card words a row: no place, and no claim that either part was checked. */
    public function device(?string $userAgent, ?string $ipAddress, string $locale): string
    {
        $named = $this->named($userAgent, $locale);

        return null === $ipAddress || '' === $ipAddress
            ? $named
            : $this->line('password.device.from', $locale, ['{device}' => $named, '{address}' => $ipAddress]);
    }

    /** The device as the devices card names its row, or null for a user agent neither the app's format nor the browser rules can read. */
    public function agentName(?string $userAgent, string $locale): ?string
    {
        $agent = ReadableAgent::of($userAgent);

        return match (AppDevice::of($userAgent)) {
            AppDevice::IPhone => $this->line('password.device.appIPhone', $locale),
            AppDevice::IPad => $this->line('password.device.appIPad', $locale),
            AppDevice::Phone => $this->line('password.device.appAndroidPhone', $locale),
            AppDevice::Tablet => $this->line('password.device.appAndroidTablet', $locale),
            null => null === $agent ? null : $this->line('password.device.agent', $locale, ['{browser}' => $agent->browser, '{platform}' => $agent->platform]),
        };
    }
}
