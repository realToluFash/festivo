<?php

declare(strict_types=1);

namespace App\Http\Listener;

use App\Enum\ErrorCode;
use App\Http\ProblemRenderer;
use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationFailureEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Events;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/** Missing, malformed and expired look the same: a client refreshes on any of them. */
#[AsEventListener(event: Events::JWT_NOT_FOUND)]
#[AsEventListener(event: Events::JWT_INVALID)]
#[AsEventListener(event: Events::JWT_EXPIRED)]
final readonly class TokenRefusalListener
{
    public function __construct(
        private ProblemRenderer $problemRenderer,
    ) {
    }

    public function __invoke(AuthenticationFailureEvent $event): void
    {
        $request = $event->getRequest();

        if (null === $request) {
            return;
        }

        $event->setResponse($this->problemRenderer->render(
            $request,
            ErrorCode::Unauthenticated,
            'Please sign in to continue.',
            [],
            ['WWW-Authenticate' => 'Bearer'],
        ));
    }
}
