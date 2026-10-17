<?php

declare(strict_types=1);

namespace App\Domain\User\Listener;

use App\Domain\User\Mail\AccountLanguage;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/** An account made before sc-852 has no language: its next authenticated request gives it the one asked in. */
#[AsEventListener(event: KernelEvents::CONTROLLER)]
final readonly class AccountLanguageListener
{
    public function __construct(
        private Security $security,
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function __invoke(ControllerEvent $event): void
    {
        $user = $event->isMainRequest() ? $this->security->getUser() : null;

        if ($user instanceof User && AccountLanguage::rememberIfNone($user, $event->getRequest())) {
            $this->entityManager->flush();
        }
    }
}
