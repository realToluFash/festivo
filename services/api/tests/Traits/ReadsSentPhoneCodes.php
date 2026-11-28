<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Domain\User\Verification\RecordingTextMessageSender;
use App\Domain\User\Verification\RecordingWhatsAppSender;
use Psl\Regex;
use Psl\Vec;

/**
 * The newest code sent to a number, by WhatsApp or by text.
 *
 * @phpstan-require-extends \App\Tests\ApiTestCase
 */
trait ReadsSentPhoneCodes
{
    private function codeTo(string $number): string
    {
        foreach (Vec\reverse(self::service(RecordingWhatsAppSender::class)->sent) as $sent) {
            if ($sent['to'] === $number) {
                return $sent['code'];
            }
        }

        foreach (Vec\reverse(self::service(RecordingTextMessageSender::class)->sent) as $text) {
            if ($text['to'] === $number) {
                return Regex\first_match($text['body'], '/(\d{6})/')[1] ?? '';
            }
        }

        self::fail('nothing sent to ' . $number);
    }
}
