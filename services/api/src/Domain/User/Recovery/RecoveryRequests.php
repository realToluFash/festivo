<?php

declare(strict_types=1);

namespace App\Domain\User\Recovery;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Contracts\Service\ResetInterface;
use Throwable;

/** Acted on after the answer has gone, or a registered address would answer slower than an unknown one. */
#[AsEventListener(event: KernelEvents::TERMINATE, method: 'fulfil')]
final class RecoveryRequests implements ResetInterface
{
    /** @var list<array{email: string, locale: string}> */
    private array $requests = [];

    public function __construct(
        private readonly PasswordRecovery $passwordRecovery,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** The request's language goes with it: the email is written after the request has gone. */
    public function accept(string $email, string $locale): void
    {
        $this->requests[] = ['email' => $email, 'locale' => $locale];
    }

    public function fulfil(): void
    {
        $requests = $this->requests;
        $this->requests = [];

        foreach ($requests as $asked) {
            try {
                $this->passwordRecovery->request($asked['email'], $asked['locale']);
            } catch (Throwable $e) {
                $this->logger->error('A password reset request could not be fulfilled.', ['exception' => $e::class]);
            }
        }
    }

    public function reset(): void
    {
        $this->requests = [];
    }
}
