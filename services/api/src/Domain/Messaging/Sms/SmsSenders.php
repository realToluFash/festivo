<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use App\Domain\Messaging\Sms\Model\SmsFrom;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Soirely's sender for a number's country, never an organisation's own (sc-3946): the alphanumeric id configured for its dialling code, else Soirely's number. */
final readonly class SmsSenders
{
    /** @param string $alphanumericIds "dialling code=id" pairs, commas between, such as "234=Soirely" */
    public function __construct(
        #[Autowire(env: 'SMS_FROM')]
        private string $number,
        #[Autowire(env: 'SMS_ALPHANUMERIC_SENDERS')]
        private string $alphanumericIds,
    ) {
    }

    /** @param string $to E.164 */
    public function to(string $to): SmsFrom
    {
        foreach (Vec\filter(Str\split($this->alphanumericIds, ',')) as $pair) {
            [$code, $id] = [...Vec\map(Str\split($pair, '=', 2), Str\trim(...)), ''];

            if ('' !== $code && '' !== $id && Str\starts_with($to, '+' . $code)) {
                return new SmsFrom($id, false);
            }
        }

        return new SmsFrom($this->number, true);
    }
}
