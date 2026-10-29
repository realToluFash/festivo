<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\PushTargets;
use App\Domain\User\CallerSession;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PushTargetKind;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Encoding;
use Psl\Encoding\Base64;
use Psl\Iter;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** This device's push, registered under the caller's session so that signing out here ends it (sc-3980). */
#[Authenticated]
final readonly class PushTargetsController
{
    /** The browsers' push services. The worker posts to the endpoint, so anything else would let a member aim it at any host. */
    private const array WEB_PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

    private const int ADDRESS_LENGTH = 2048;

    private const int PUBLIC_KEY_BYTES = 65;

    private const int AUTH_SECRET_BYTES = 16;

    public function __construct(
        private Security $security,
        private CallerSession $callerSession,
        private PushTargets $pushTargets,
        #[Autowire(env: 'VAPID_PUBLIC_KEY')]
        private string $vapidPublicKey,
    ) {
    }

    /** The VAPID public key a browser subscribes with. */
    #[Route('/api/auth/push-targets', name: 'auth_push_targets_key', methods: ['GET'])]
    public function key(): JsonResponse
    {
        return new JsonResponse(['webPushKey' => $this->vapidPublicKey]);
    }

    /** A Web Push subscription (`endpoint` and its `keys`) or an Expo push token. Registering one again moves it to the caller. */
    #[Route('/api/auth/push-targets', name: 'auth_push_targets_register', methods: ['PUT'])]
    public function register(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'kind' => Type\backed_enum(PushTargetKind::class),
            'address' => Type\non_empty_string(),
            'keys' => Type\optional(Type\shape(['p256dh' => Type\non_empty_string(), 'auth' => Type\non_empty_string()])),
        ]));
        $session = $this->callerSession->chain() ?? throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
        $keys = $body['keys'] ?? null;
        $acceptable = Str\length($body['address']) <= self::ADDRESS_LENGTH && match ($body['kind']) {
            PushTargetKind::Web => null !== $keys && self::isWebPushEndpoint($body['address']) && self::isWebPushKeys($keys['p256dh'], $keys['auth']),
            PushTargetKind::Expo => null === $keys && Regex\matches($body['address'], '/^Expo(nent)?PushToken\[[^\]]+\]$/'),
        };

        if (!$acceptable) {
            throw ApiException::validation([[
                'propertyPath' => 'address',
                'message' => 'notifications.push_target_refused',
                'code' => 'push_target_refused',
            ]], 'notifications.push_target_refused');
        }

        $this->pushTargets->register($this->user()->getId(), $session, $body['kind'], $body['address'], $keys['p256dh'] ?? null, $keys['auth'] ?? null);

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /** What the browser's encryption needs: an uncompressed P-256 point and a 16-byte secret, base64url. */
    private static function isWebPushKeys(string $publicKey, #[SensitiveParameter] string $authSecret): bool
    {
        $point = self::decoded($publicKey);

        return null !== $point && self::PUBLIC_KEY_BYTES === Str\Byte\length($point) && Str\Byte\starts_with($point, "\x04")
            && self::AUTH_SECRET_BYTES === Str\Byte\length(self::decoded($authSecret) ?? '');
    }

    private static function decoded(#[SensitiveParameter] string $base64Url): ?string
    {
        try {
            return Base64\decode(Str\trim_right($base64Url, '='), Base64\Variant::UrlSafe, false);
        } catch (Encoding\Exception\ExceptionInterface) {
            return null;
        }
    }

    private static function isWebPushEndpoint(string $address): bool
    {
        $parts = \parse_url($address);

        if (!\is_array($parts) || 'https' !== ($parts['scheme'] ?? null) || isset($parts['port']) || isset($parts['user'])) {
            return false;
        }

        $host = Str\lowercase($parts['host'] ?? '');

        return Iter\any(self::WEB_PUSH_HOSTS, static fn (string $allowed): bool => $host === $allowed || Str\ends_with($host, '.' . $allowed));
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
