<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use App\Domain\Messaging\Sms\Model\SmsKeyword;
use App\Enum\SmsKeywordAction;
use Psl\Str;

/** The CTIA keywords and their es, fr and pt words (sc-3946). A keyword is the whole text, in any case, with or without closing punctuation. */
final class SmsKeywordReader
{
    public static function read(string $body): ?SmsKeyword
    {
        return match (Str\uppercase(Str\trim($body, " \t\n\r.!"))) {
            'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT' => new SmsKeyword(SmsKeywordAction::Stop),
            'ARRÊT', 'ARRET' => new SmsKeyword(SmsKeywordAction::Stop, 'fr'),
            'BAJA' => new SmsKeyword(SmsKeywordAction::Stop, 'es'),
            'PARAR', 'SAIR' => new SmsKeyword(SmsKeywordAction::Stop, 'pt'),
            'START', 'UNSTOP' => new SmsKeyword(SmsKeywordAction::Start),
            'HELP' => new SmsKeyword(SmsKeywordAction::Help),
            default => null,
        };
    }
}
