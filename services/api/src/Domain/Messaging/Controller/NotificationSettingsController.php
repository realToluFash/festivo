<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\NotificationPreferenceSetter;
use App\Domain\Messaging\StoredNotificationPreferences;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Notification settings under Your account (sc-3980): the six categories against Push and Email. In the app always goes, so it is not a column. */
#[Authenticated]
final readonly class NotificationSettingsController
{
    public function __construct(
        private Security $security,
        private StoredNotificationPreferences $storedNotificationPreferences,
        private NotificationPreferenceSetter $notificationPreferenceSetter,
    ) {
    }

    #[Route('/api/auth/notification-settings', name: 'auth_notification_settings', methods: ['GET'])]
    public function show(): JsonResponse
    {
        return new JsonResponse(['categories' => $this->categories($this->user())]);
    }

    /** One switch, saved as it changes. Account & security email is refused: 422 `notifications.not_switchable`. */
    #[Route('/api/auth/notification-settings', name: 'auth_notification_settings_set', methods: ['PUT'])]
    public function set(Request $request): JsonResponse
    {
        $user = $this->user();
        $body = Input::body($request, Type\shape([
            'category' => Type\backed_enum(NotificationCategory::class),
            'channel' => Type\backed_enum(NotificationChannel::class),
            'on' => Type\bool(),
        ]));

        if (!StoredNotificationPreferences::isSwitchable($body['category'], $body['channel'])) {
            throw ApiException::validation([[
                'propertyPath' => 'channel',
                'message' => 'notifications.not_switchable',
                'code' => 'not_switchable',
            ]], 'notifications.not_switchable');
        }

        $this->notificationPreferenceSetter->set($user, $body['category'], $body['channel'], $body['on']);

        return new JsonResponse(['categories' => $this->categories($user)]);
    }

    /** @return list<array{category: string, push: array{on: bool, switchable: bool}, email: array{on: bool, switchable: bool}}> */
    private function categories(User $user): array
    {
        return Vec\map(NotificationCategory::cases(), fn (NotificationCategory $category): array => [
            'category' => $category->value,
            'push' => $this->cell($user, $category, NotificationChannel::Push),
            'email' => $this->cell($user, $category, NotificationChannel::Email),
        ]);
    }

    /** @return array{on: bool, switchable: bool} */
    private function cell(User $user, NotificationCategory $category, NotificationChannel $channel): array
    {
        return [
            'on' => $this->storedNotificationPreferences->allows($user->getId(), $category, $channel),
            'switchable' => StoredNotificationPreferences::isSwitchable($category, $channel),
        ];
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
