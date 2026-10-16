<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\InEvent;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Access\Policy\Policy;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use LogicException;
use Psl\Str;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Uid\Uuid;

#[AsEventListener(event: KernelEvents::CONTROLLER)]
final readonly class AccessListener
{
    /** The event an InEvent route resolved, for loading its sub-resources through it. */
    public const string EVENT = '_access_event';

    public function __construct(
        private Security $security,
        private MembershipDirectoryInterface $membershipDirectory,
        private EventDirectoryInterface $eventDirectory,
    ) {
    }

    public function __invoke(ControllerEvent $event): void
    {
        $request = $event->getRequest();
        $route = (string) $request->attributes->get('_route', '');

        if (!$event->isMainRequest() || FrameworkRoutes::isPublic($route)) {
            return;
        }

        $policy = $this->policyOf($event, $route);

        match (true) {
            $policy instanceof PublicAccess => null,
            $policy instanceof Authenticated => $this->account(),
            $policy instanceof InOrganisation => $this->inOrganisation($request, $policy),
            $policy instanceof InEvent => $this->inEvent($request, $policy),
            default => throw new LogicException(Str\format('Route "%s" has a policy nothing enforces.', $route)),
        };
    }

    private function inOrganisation(Request $request, InOrganisation $policy): void
    {
        $organisationId = self::uuid($request, $policy->parameter);

        $this->require($this->account(), $organisationId, $policy->permission);
    }

    /** The event is found first, and its organisation's membership checked before any permission. */
    private function inEvent(Request $request, InEvent $policy): void
    {
        $eventId = self::uuid($request, $policy->parameter);
        $user = $this->account();
        $organisationId = $this->eventDirectory->organisationOf($eventId) ?? throw self::notFound();

        $this->require($user, $organisationId, $policy->permission);

        $request->attributes->set(self::EVENT, $eventId);
    }

    /** Not a member reads as not found: a 403 would confirm the organisation or event exists. */
    private function require(User $user, Uuid $organisationId, Permission $permission): void
    {
        $grants = $this->membershipDirectory->grantsIn($user, $organisationId) ?? throw self::notFound();

        if (!$grants->holds($permission)) {
            throw new ApiException(
                ErrorCode::PermissionRequired,
                Str\format('This needs the %s permission.', $permission->value),
                [],
                null,
                [],
                ['permission' => $permission->value],
            );
        }
    }

    private function account(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.', [], null, [
                'WWW-Authenticate' => 'Bearer',
            ]);
        }

        return $user;
    }

    private function policyOf(ControllerEvent $event, string $route): Policy
    {
        $resourceClass = $event->getRequest()->attributes->get('_api_resource_class');

        return PolicyReader::forRoute($event->getController(), $resourceClass)
            ?? throw new LogicException(Str\format('Route "%s" has no access policy.', $route));
    }

    private static function uuid(Request $request, string $parameter): Uuid
    {
        $value = $request->attributes->get($parameter);

        if (!\is_string($value) || !Uuid::isValid($value)) {
            throw self::notFound();
        }

        return Uuid::fromString($value);
    }

    private static function notFound(): ApiException
    {
        return ApiException::notFound('Not found.');
    }
}
