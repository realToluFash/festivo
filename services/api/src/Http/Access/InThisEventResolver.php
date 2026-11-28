<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use App\Http\Exception\ApiException;
use LogicException;
use Psl\Str;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Controller\ValueResolverInterface;
use Symfony\Component\HttpKernel\ControllerMetadata\ArgumentMetadata;
use Symfony\Component\Uid\Uuid;

/** Ahead of Doctrine's own resolver, which would load the row by its bare id. Another event's id is a 404. */
#[AutoconfigureTag('controller.argument_value_resolver', ['priority' => 150])]
final readonly class InThisEventResolver implements ValueResolverInterface
{
    /** @param iterable<EventScopedRepositoryInterface> $repositories */
    public function __construct(
        #[AutowireIterator(EventScopedRepositoryInterface::TAG)]
        private iterable $repositories,
    ) {
    }

    /** @return iterable<object> */
    public function resolve(Request $request, ArgumentMetadata $argument): iterable
    {
        $scoped = $argument->getAttributesOfType(InThisEvent::class)[0] ?? null;

        if (null === $scoped) {
            return [];
        }

        $eventId = $request->attributes->get(AccessListener::EVENT);
        $class = (string) $argument->getType();
        $repository = $this->repositoryFor($class);

        if (!$eventId instanceof Uuid || null === $repository) {
            throw new LogicException(Str\format('%s can only be loaded within an event, on an InEvent route.', $class));
        }

        $id = $request->attributes->get($scoped->parameter);
        $found = \is_string($id) && Uuid::isValid($id)
            ? $repository->findOneInEvent($eventId, Uuid::fromString($id))
            : null;

        return [$found ?? throw ApiException::notFound('access.not_found')];
    }

    private function repositoryFor(string $class): ?EventScopedRepositoryInterface
    {
        foreach ($this->repositories as $repository) {
            if ($repository->loads() === $class) {
                return $repository;
            }
        }

        return null;
    }
}
