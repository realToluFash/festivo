<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies\Controller;

use App\Domain\Messaging\GuestReplies\GuestRepliesUnsubscribe;
use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Domain\Messaging\NotificationPreferenceSetter;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The summary's unsubscribe link (sc-4331, AC 10 to 14). The mail app's one-click POST (RFC 8058) switches Guest replies email off, every time. A GET changes nothing, as mail scanners and link previews open links: it sends the browser to the page, the token after its `#`. The page asks and sets through the last two routes, the token in the body. No answer names the member, their address or an event.
 */
#[PublicAccess]
final readonly class GuestRepliesUnsubscribeController
{
    public function __construct(
        private GuestRepliesUnsubscribe $guestRepliesUnsubscribe,
        private EntityManagerInterface $entityManager,
        private NotificationPreferencesInterface $notificationPreferences,
        private NotificationPreferenceSetter $notificationPreferenceSetter,
        #[Autowire(env: 'CORS_WEB_ORIGIN')]
        private string $webOrigin,
    ) {
    }

    #[Route('/api/unsubscribe/guest-replies/{token}', name: 'guest_replies_unsubscribe', requirements: ['token' => GuestRepliesUnsubscribe::PATTERN], methods: ['GET'])]
    public function open(#[SensitiveParameter] string $token): Response
    {
        return self::private(new RedirectResponse(Str\trim_right($this->webOrigin, '/') . GuestRepliesUnsubscribe::PAGE . \rawurlencode($token), Response::HTTP_SEE_OTHER));
    }

    #[Route('/api/unsubscribe/guest-replies/{token}', name: 'guest_replies_unsubscribe_post', requirements: ['token' => GuestRepliesUnsubscribe::PATTERN], methods: ['POST'])]
    public function oneClick(#[SensitiveParameter] string $token): Response
    {
        $user = $this->member($token);

        if (null === $user) {
            return self::private(new Response(null, Response::HTTP_NOT_FOUND));
        }

        $this->notificationPreferenceSetter->set($user, NotificationCategory::GuestReplies, NotificationChannel::Email, false);

        return self::private(new Response(null, Response::HTTP_OK));
    }

    #[Route('/api/unsubscribe/guest-replies', name: 'guest_replies_unsubscribe_status', methods: ['POST'])]
    public function status(Request $request): JsonResponse
    {
        $user = $this->member(Input::body($request, Type\shape(['token' => Type\string()]))['token']) ?? throw ApiException::notFound('access.not_found');

        return $this->answer($user);
    }

    #[Route('/api/unsubscribe/guest-replies', name: 'guest_replies_unsubscribe_set', methods: ['PUT'])]
    public function set(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['token' => Type\string(), 'emailOn' => Type\bool()]));
        $user = $this->member($body['token']) ?? throw ApiException::notFound('access.not_found');
        $this->notificationPreferenceSetter->set($user, NotificationCategory::GuestReplies, NotificationChannel::Email, $body['emailOn']);

        return $this->answer($user);
    }

    private function answer(User $user): JsonResponse
    {
        return self::private(new JsonResponse(['emailOn' => $this->notificationPreferences->allows($user->getId(), NotificationCategory::GuestReplies, NotificationChannel::Email)]));
    }

    private function member(#[SensitiveParameter] string $token): ?User
    {
        $userId = $this->guestRepliesUnsubscribe->memberOf($token);

        return null === $userId ? null : $this->entityManager->find(User::class, $userId);
    }

    /**
     * @template T of Response
     *
     * @param T $response
     *
     * @return T
     */
    private static function private(Response $response): Response
    {
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
