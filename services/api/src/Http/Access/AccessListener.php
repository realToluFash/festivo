<?php

declare(strict_types=1);

namespace App\Http\Access;

use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Interfaces\OnboardingGateInterface;
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
use Symfony\Contracts\Translation\TranslatorInterface;

#[AsEventListener(event: KernelEvents::CONTROLLER)]
final readonly class AccessListener
{
    /** The event an InEvent route resolved, for loading its sub-resources through it. */
    public const string EVENT = '_access_event';

    public function __construct(
        private Security $security,
        private OnboardingGateInterface $onboardingGate,
        private MembershipDirectoryInterface $membershipDirectory,
        private EventDirectoryInterface $eventDirectory,
        private TranslatorInterface $translator,
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
            $policy instanceof Authenticated => $this->account($route),
            $policy instanceof InOrganisation => $this->inOrganisation($request, $route, $policy),
            $policy instanceof InEvent => $this->inEvent($request, $route, $policy),
            default => throw new LogicException(Str\format('Route "%s" has a policy nothing enforces.', $route)),
        };
    }

    private function inOrganisation(Request $request, string $route, InOrganisation $policy): void
    {
        $organisationId = self::uuid($request, $policy->parameter);

        $this->require($request, $this->account($route), $organisationId, $policy->permission);
    }

    /** The event is found first, and its organisation's membership checked before any permission. */
    private function inEvent(Request $request, string $route, InEvent $policy): void
    {
        $eventId = self::uuid($request, $policy->parameter);
        $user = $this->account($route);
        $organisationId = $this->eventDirectory->organisationOf($eventId) ?? throw self::notFound();

        $this->require($request, $user, $organisationId, $policy->permission);

        $request->attributes->set(self::EVENT, $eventId);
    }

    /** Not a member reads as not found: a 403 would confirm the organisation or event exists. */
    private function require(Request $request, User $user, Uuid $organisationId, ?Permission $permission): void
    {
        $grants = $this->membershipDirectory->grantsIn($user, $organisationId) ?? throw self::notFound();

        if ($grants->isHeldForTwoFactor()) {
            throw new ApiException(ErrorCode::OrganisationTwoFactorOverdue, 'access.two_factor_overdue');
        }

        if ($grants->isReadOnly() && !$request->isMethodSafe()) {
            throw new ApiException(ErrorCode::OAuthOnlyUnlinked, 'access.provider_only_unlinked');
        }

        if (null !== $permission && $grants->withholds($permission)) {
            throw new ApiException(
                ErrorCode::OrganisationTwoFactorRequired,
                'access.two_factor_required',
                [],
                null,
                [],
                ['permission' => $permission->value],
            );
        }

        if (null !== $permission && !$grants->holds($permission)) {
            throw new ApiException(
                ErrorCode::PermissionRequired,
                'access.permission_required',
                [],
                null,
                [],
                ['permission' => $permission->value],
                ['{permission}' => $permission->value],
            );
        }
    }

    /** Signed in, and through the onboarding gate unless the route is on its exempt list. */
    private function account(string $route): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in', [], null, [
                'WWW-Authenticate' => 'Bearer',
            ]);
        }

        $refusal = $this->onboardingGate->refusalFor($user, $route);

        if (null !== $refusal) {
            throw new ApiException($refusal, $this->translator->trans(match (true) {
                ErrorCode::AccountUnverified !== $refusal => 'gate.details',
                // The title is the same for every occurrence (RFC 9457 §3.1.3); the detail names what is unverified.
                true !== $user->getPrimaryEmailAddress()?->isVerified() => 'gate.email_unverified',
                default => 'gate.phone_unverified',
            }));
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
        return ApiException::notFound('access.not_found');
    }
}
