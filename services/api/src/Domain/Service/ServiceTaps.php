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
use Closure;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
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

    /**
     * The same key twice at once waits for the first to be kept, then gets its answer: nothing is applied twice, and a retry of a tap that landed is not refused.
     *
     * @param Closure(): JsonResponse $write
     */
    public function once(Event $event, User $by, SentTap $sent, Closure $write): JsonResponse
    {
        $hold = $by->getId()->toRfc4122() . ':' . $sent->key;
        $this->connection->executeStatement('SELECT pg_advisory_lock(hashtextextended(:hold, 0))', ['hold' => $hold]);

        try {
            $earlier = $this->earlier($by, $sent);

            if (null !== $earlier) {
                return $earlier;
            }

            try {
                $response = $write();
            } catch (ApiException $refusal) {
                // A request the device got wrong is not kept, so it can be sent again put right; a refusal of the step itself is the first answer.
                if (Response::HTTP_FORBIDDEN === $refusal->errorCode->status() || Response::HTTP_CONFLICT === $refusal->errorCode->status()) {
                    $this->refused($event, $by, $sent, $refusal);
                }

                throw $refusal;
            }

            $this->answered($event, $by, $sent, $response);

            return $response;
        } finally {
            $this->connection->executeStatement('SELECT pg_advisory_unlock(hashtextextended(:hold, 0))', ['hold' => $hold]);
        }
    }

    /** Every key older than the 24 hours it is kept, with the read its answer holds. */
    public function prune(): int
    {
        return (int) $this->connection->executeStatement('DELETE FROM service_taps WHERE made_at < :since', ['since' => $this->since()->format('Y-m-d H:i:s')]);
    }

    public function countPrunable(): int
    {
        return (int) $this->connection->fetchOne('SELECT COUNT(*) FROM service_taps WHERE made_at < :since', ['since' => $this->since()->format('Y-m-d H:i:s')]);
    }

    /** The first answer to the same key, for the device that never heard it; the same key on a different request is a 422. */
    private function earlier(User $by, SentTap $sent): ?JsonResponse
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

    private function answered(Event $event, User $by, SentTap $sent, JsonResponse $response): void
    {
        $this->keep($event, $by, $sent, $response->getStatusCode(), Json\typed((string) $response->getContent(), Type\dict(Type\array_key(), Type\mixed())), null);
    }

    private function refused(Event $event, User $by, SentTap $sent, ApiException $refusal): void
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
