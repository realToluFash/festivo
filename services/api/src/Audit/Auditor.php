<?php

declare(strict_types=1);

namespace App\Audit;

use App\Entity\AuditEntry;
use App\Enum\Actor;
use App\Http\Listener\CorrelationIdListener;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Uid\Uuid;

final readonly class Auditor
{
    public function __construct(
        private EntityManagerInterface $em,
        private RequestStack $requests,
    ) {
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes field => [before, after] */
    public function record(
        string $action,
        string $subjectType,
        Uuid $subjectId,
        Actor $actorType = Actor::System,
        ?Uuid $actorId = null,
        ?string $actorLabel = null,
        array $changes = [],
    ): AuditEntry {
        $request = $this->requests->getCurrentRequest();

        $entry = new AuditEntry(
            $actorType,
            $actorId,
            $actorLabel,
            $subjectType,
            $subjectId,
            $action,
            $changes,
            $request?->getClientIp(),
            $this->correlationId($request),
        );

        $this->em->persist($entry);

        return $entry;
    }

    /**
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after
     *
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public static function diff(array $before, array $after): array
    {
        $changes = [];

        foreach (array_keys($before + $after) as $field) {
            $was = $before[$field] ?? null;
            $now = $after[$field] ?? null;

            if ($was !== $now) {
                $changes[$field] = [$was, $now];
            }
        }

        return $changes;
    }

    private function correlationId(?\Symfony\Component\HttpFoundation\Request $request): ?string
    {
        $id = $request?->attributes->get(CorrelationIdListener::ATTRIBUTE);

        return \is_string($id) ? $id : null;
    }
}
