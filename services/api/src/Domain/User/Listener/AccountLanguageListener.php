<?php

declare(strict_types=1);

namespace App\Domain\User\Listener;

use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/** An account with no language (sc-852) or zone (sc-868) takes the ones its next authenticated request names. */
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

        if (!$user instanceof User) {
            return;
        }

        $language = AccountLanguage::rememberIfNone($user, $event->getRequest());
        $zone = AccountTimeZone::rememberIfNone($user, $event->getRequest());

        if ($language || $zone) {
            $this->entityManager->flush();
        }
    }
}
