<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\Organisation\Regions;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Entity\Event;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Regex;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class EventRules
{
    private const string LOCAL_TIME = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/';

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * @param array{name: ?string, startsAt: ?string, endsAt: ?string, timeZone: string, currency: string} $fields
     *
     * @return array{name: string, startsAt: DateTimeImmutable, endsAt: DateTimeImmutable, currency: string}
     */
    public function check(array $fields): array
    {
        $name = Str\trim($fields['name'] ?? '');
        $currency = Str\uppercase(Str\trim($fields['currency']));
        $zone = AccountTimeZone::canonical(Str\trim($fields['timeZone']));
        $violations = [];

        if ('' === $name) {
            $violations[] = $this->violation('name', 'validation.event_name_required');
        } elseif (Str\length($name) > Event::NAME_MAXIMUM) {
            $violations[] = $this->violation('name', 'validation.event_name_too_long', ['{count}' => (string) Event::NAME_MAXIMUM]);
        }

        $startsAt = $this->wallClock($fields['startsAt'], 'startsAt', 'validation.event_start_required', $violations);
        $endsAt = $this->wallClock($fields['endsAt'], 'endsAt', 'validation.event_end_required', $violations);

        if (null === $zone) {
            $violations[] = $this->violation('timeZone', 'validation.timezone_invalid');
        }

        if (!Regions::isCurrency($currency)) {
            $violations[] = $this->violation('currency', 'validation.currency_invalid');
        }

        if (null !== $zone && null !== $startsAt && null !== $endsAt) {
            $startsAt = LocalTimeResolver::resolve($startsAt, new DateTimeZone($zone));
            $endsAt = LocalTimeResolver::resolve($endsAt, new DateTimeZone($zone));

            if ($endsAt < $startsAt) {
                $violations[] = $this->violation('endsAt', 'validation.event_end_before_start');
            }
        }

        if ([] !== $violations || null === $startsAt || null === $endsAt) {
            throw ApiException::validation($violations);
        }

        return ['name' => $name, 'startsAt' => $startsAt, 'endsAt' => $endsAt, 'currency' => $currency];
    }

    /**
     * @param list<array{propertyPath: string, message: string, code: string}> $violations
     */
    private function wallClock(?string $typed, string $path, string $missing, array &$violations): ?DateTimeImmutable
    {
        $typed = Str\trim($typed ?? '');

        if ('' === $typed) {
            $violations[] = $this->violation($path, $missing);

            return null;
        }

        $value = Regex\matches($typed, self::LOCAL_TIME) ? Str\pad_right($typed, 19, ':00') : '';
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s', $value, new DateTimeZone('UTC'));

        if (false === $parsed || $parsed->format('Y-m-d\TH:i:s') !== $value) {
            $violations[] = $this->violation($path, 'validation.event_time_invalid');

            return null;
        }

        return $parsed;
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, $parameters),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
