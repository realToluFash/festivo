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
    /** @var list<string> */
    private array $addresses = [];

    public function __construct(
        private readonly PasswordRecovery $passwordRecovery,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function accept(string $email): void
    {
        $this->addresses[] = $email;
    }

    public function fulfil(): void
    {
        $addresses = $this->addresses;
        $this->addresses = [];

        foreach ($addresses as $email) {
            try {
                $this->passwordRecovery->request($email);
            } catch (Throwable $e) {
                $this->logger->error('A password reset request could not be fulfilled.', ['exception' => $e::class]);
            }
        }
    }

    public function reset(): void
    {
        $this->addresses = [];
    }
}
