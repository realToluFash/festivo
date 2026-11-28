<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Audience;

use App\Domain\Messaging\Interfaces\AudienceResolverInterface;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Recipient;
use App\Enum\NotificationAudienceKind;
use Psl\Iter;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** Fixed when it was queued: the address a code was issued for, the account that changed, the member being told. */
final readonly class PersonAudienceResolver implements AudienceResolverInterface
{
    public function kind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Person;
    }

    public function resolve(Audience $audience, ?Uuid $after, int $limit): array
    {
        return null === $after ? $audience->only : [];
    }

    public function recipient(Audience $audience, Uuid $id): ?Recipient
    {
        if (!Iter\any($audience->only, static fn (Uuid $one): bool => $one->equals($id))) {
            return null;
        }

        $address = Type\string()->coerce($audience->conditions['address'] ?? null);

        return new Recipient(NotificationAudienceKind::Person, $id, $address, Type\string()->coerce($audience->conditions['locale'] ?? null), $address);
    }
}
