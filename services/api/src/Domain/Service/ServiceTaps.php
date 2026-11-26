<?php

declare(strict_types=1);

namespace App\Domain\Service;

use App\Domain\Service\Model\SentTap;
use App\Entity\Event;
use App\Entity\ServiceTap;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\ServiceTapRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Uid\Uuid;

/** Every service write's key (sc-4028), kept 24 hours with its first answer. */
final readonly class ServiceTaps
{
    public function __construct(
        private ServiceTapRepository $serviceTapRepository,
        private Connection $connection,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $serviceTapLimiter,
    ) {
    }

    public function sent(Request $request, User $by): SentTap
    {
        $limit = $this->serviceTapLimiter->create($by->getId()->toRfc4122())->consume();

        if (!$limit->isAccepted()) {
            throw ApiException::tooManyAttempts('limits.service_taps', $limit->getRetryAfter());
        }

        $key = Str\trim($request->headers->get('Idempotency-Key') ?? '');

        if ('' === $key || Str\length($key) > ServiceTap::KEY_MAXIMUM) {
            throw new ApiException(ErrorCode::IdempotencyKeyRequired, 'service.idempotency_key_required');
        }

        return new SentTap($key, \hash('sha256', $request->getMethod() . ' ' . $request->getPathInfo() . "\n" . $request->getContent()));
    }

    /** The first answer to the same key, for the device that never heard it; the same key on a different request is a 422. */
    public function earlier(User $by, SentTap $sent): ?JsonResponse
    {
        $tap = $this->serviceTapRepository->findKept($by, $sent->key, $this->since());

        if (null === $tap) {
            return null;
        }

        if ($tap->getFingerprint() !== $sent->fingerprint) {
            throw new ApiException(ErrorCode::IdempotencyKeyReused, 'service.idempotency_key_reused');
        }

        $refused = $tap->getRefused();

        if (null !== $refused) {
            throw new ApiException(ErrorCode::from($refused['code']), $refused['message'], [], null, $refused['headers'], $refused['members'], $refused['parameters']);
        }

        return new JsonResponse($tap->getAnswer(), $tap->getStatus());
    }

    public function answered(Event $event, User $by, SentTap $sent, JsonResponse $response): void
    {
        $this->keep($event, $by, $sent, $response->getStatusCode(), Json\typed((string) $response->getContent(), Type\dict(Type\array_key(), Type\mixed())), null);
    }

    public function refused(Event $event, User $by, SentTap $sent, ApiException $refusal): void
    {
        $this->keep($event, $by, $sent, $refusal->errorCode->status(), null, [
            'code' => $refusal->errorCode->value,
            'message' => $refusal->getMessage(),
            'members' => $refusal->members,
            'parameters' => $refusal->parameters,
            'headers' => $refusal->headers,
        ]);
    }

    /**
     * @param array<array-key, mixed>|null $answer
     * @param array<string, mixed>|null    $refused
     */
    private function keep(Event $event, User $by, SentTap $sent, int $status, ?array $answer, ?array $refused): void
    {
        $this->serviceTapRepository->forget($by, $this->since());
        $this->connection->executeStatement(
            'INSERT INTO service_taps (id, event_id, by_id, idempotency_key, fingerprint, made_at, status, answer, refused) VALUES (:id, :event, :by, :key, :fingerprint, :madeAt, :status, :answer, :refused) ON CONFLICT (by_id, idempotency_key) DO NOTHING',
            [
                'id' => Uuid::v7()->toRfc4122(),
                'event' => $event->getId()->toRfc4122(),
                'by' => $by->getId()->toRfc4122(),
                'key' => $sent->key,
                'fingerprint' => $sent->fingerprint,
                'madeAt' => $this->clock->now()->format('Y-m-d H:i:s'),
                'status' => $status,
                'answer' => null === $answer ? null : Json\encode($answer),
                'refused' => null === $refused ? null : Json\encode($refused),
            ],
        );
    }

    private function since(): DateTimeImmutable
    {
        return $this->clock->now()->modify(Str\format('-%d hours', ServiceTap::KEPT_HOURS));
    }
}
