<?php

declare(strict_types=1);

namespace App\Domain\User\Device;

use App\Domain\User\TokenIssuer;
use App\Entity\User;
use App\Http\AfterResponse;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Uid\Uuid;

/** Which devices an account has signed in on, and the email when a sign-in comes from one it has not (sc-511). */
final readonly class KnownDevices
{
    /** Emails per account in any 24 hours. Beyond it the sign-ins are still on the devices list. */
    public const int DAILY_CAP = 10;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private NewDeviceMailer $newDeviceMailer,
        private AfterResponse $afterResponse,
        private ClockInterface $clock,
    ) {
    }

    /** A sign-in: a device not seen on this account before is remembered, and the person told, within the cap. */
    public function signedIn(User $user, Request $request): void
    {
        $device = $this->remember($user, $request);

        if (null === $device || !$this->claimNotice($user, $device)) {
            return;
        }

        $at = $this->clock->now();
        $userAgent = $request->headers->get('User-Agent');
        $ipAddress = $request->getClientIp();
        $asked = $request->getLocale();
        $this->afterResponse->defer(fn () => $this->newDeviceMailer->send($user, $at, $userAgent, $ipAddress, $asked));
    }

    /**
     * This device is known to the account from now on. Registering and recovering stop here: nobody is emailed.
     *
     * @return Uuid|null the row, when the device was new to the account
     */
    public function remember(User $user, Request $request): ?Uuid
    {
        $sql = <<<'SQL'
            INSERT INTO known_devices (id, user_id, device_hash, first_seen_at)
            VALUES (:id, :user, :hash, :now)
            ON CONFLICT (user_id, device_hash) DO NOTHING
            RETURNING id
            SQL;

        $id = $this->entityManager->getConnection()->executeQuery(
            $sql,
            ['id' => Uuid::v7(), 'user' => $user->getId(), 'hash' => TokenIssuer::hash(DeviceIdentity::of($request)), 'now' => $this->clock->now()],
            ['id' => UuidType::NAME, 'user' => UuidType::NAME, 'now' => Types::DATETIME_IMMUTABLE],
        )->fetchOne();

        return \is_string($id) ? Uuid::fromString($id) : null;
    }

    private function claimNotice(User $user, Uuid $device): bool
    {
        $sql = <<<'SQL'
            UPDATE known_devices
               SET notified_at = :now
             WHERE id = :device
               AND (SELECT COUNT(*) FROM known_devices WHERE user_id = :user AND notified_at > :since) < :cap
            RETURNING id
            SQL;

        $now = $this->clock->now();

        return false !== $this->entityManager->getConnection()->executeQuery(
            $sql,
            ['now' => $now, 'device' => $device, 'user' => $user->getId(), 'since' => $now->modify('-24 hours'), 'cap' => self::DAILY_CAP],
            ['now' => Types::DATETIME_IMMUTABLE, 'device' => UuidType::NAME, 'user' => UuidType::NAME, 'since' => Types::DATETIME_IMMUTABLE, 'cap' => Types::INTEGER],
        )->fetchOne();
    }
}
