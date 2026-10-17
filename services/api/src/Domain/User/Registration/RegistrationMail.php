<?php

declare(strict_types=1);

namespace App\Domain\User\Registration;

use App\Domain\User\Mail\UserMailer;
use App\Entity\VerificationChallenge;
use Psl\Str;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Contracts\Service\ResetInterface;
use Throwable;

/** Sent after the answer has gone, so how long registration takes says nothing about the address. */
#[AsEventListener(event: KernelEvents::TERMINATE, method: 'send')]
final class RegistrationMail implements ResetInterface
{
    /** @var list<array{to: string, locale: ?string, code: ?string}> */
    private array $queued = [];

    public function __construct(
        private readonly UserMailer $userMailer,
        private readonly string $webOrigin,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function code(string $to, ?string $locale, #[SensitiveParameter] string $code): void
    {
        $this->queued[] = ['to' => $to, 'locale' => $locale, 'code' => $code];
    }

    public function alreadyRegistered(string $to, ?string $locale): void
    {
        $this->queued[] = ['to' => $to, 'locale' => $locale, 'code' => null];
    }

    public function send(): void
    {
        $queued = $this->queued;
        $this->queued = [];

        foreach ($queued as $mail) {
            try {
                null === $mail['code'] ? $this->sendAlreadyRegistered($mail['to'], $mail['locale']) : $this->sendCode($mail['to'], $mail['locale'], $mail['code']);
            } catch (Throwable $e) {
                $this->logger->error('A registration email could not be sent.', ['exception' => $e::class]);
            }
        }
    }

    public function reset(): void
    {
        $this->queued = [];
    }

    private function sendCode(string $to, ?string $locale, #[SensitiveParameter] string $code): void
    {
        $this->userMailer->send($to, $locale, 'verification.subject', [
            $this->userMailer->line('verification.heading', $locale),
            $this->userMailer->line('verification.body', $locale),
            $code,
            $this->userMailer->line('verification.expiry', $locale, ['{minutes}' => (string) VerificationChallenge::LIFETIME_MINUTES]),
            $this->userMailer->line('verification.ignore', $locale),
        ]);
    }

    private function sendAlreadyRegistered(string $to, ?string $locale): void
    {
        $origin = Str\trim_right($this->webOrigin, '/');

        $this->userMailer->send($to, $locale, 'alreadyRegistered.subject', [
            $this->userMailer->line('alreadyRegistered.body', $locale),
            $this->userMailer->line('alreadyRegistered.signIn', $locale) . ' ' . $origin . '/sign-in',
            $this->userMailer->line('alreadyRegistered.reset', $locale) . ' ' . $origin . '/forgot-password',
            $this->userMailer->line('alreadyRegistered.ignore', $locale),
        ]);
    }
}
