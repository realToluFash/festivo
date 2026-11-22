<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use Psr\Log\LoggerInterface;

/** Meta refusing a WhatsApp message for the account's payment (sc-45470): Soirely's fault, every message's, so ops are told. */
final readonly class WhatsAppPaymentRefusal
{
    public const int CODE = 131042;

    public const string MESSAGE = 'Meta refused a WhatsApp message for the account\'s payment (131042).';

    public function __construct(
        private LoggerInterface $logger,
    ) {
    }

    /** @param list<array{code?: int, title?: string, message?: string, ...}> $errors */
    public function noticeAmong(?string $messageId, array $errors): void
    {
        foreach ($errors as $error) {
            if (self::CODE === ($error['code'] ?? null)) {
                $this->logger->critical(self::MESSAGE, [
                    'message_id' => $messageId,
                    'error_title' => $error['title'] ?? $error['message'] ?? null,
                ]);

                return;
            }
        }
    }
}
