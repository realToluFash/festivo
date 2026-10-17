<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\CallerSession;
use App\Domain\User\Provider\ProviderAssertion;
use App\Domain\User\SignInMethods\ProviderLinking;
use App\Domain\User\SignInMethods\RecentProof;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Access\Policy\Authenticated;
use App\Http\CodeField;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Settings > Security, Ways to sign in: prove it is you, then link or unlink Google or Apple. */
#[Authenticated]
final readonly class SignInMethodsController
{
    public function __construct(
        private Security $security,
        private RecentProof $recentProof,
        private ProviderLinking $providerLinking,
        private ProviderAssertion $providerAssertion,
        private CodeField $codeField,
        private CallerSession $callerSession,
    ) {
    }

    /** The password, or `provider` with its `providerSignIn`, then `code` when two-factor is on; `pendingProof` retries a code. */
    #[Route('/api/auth/proof', name: 'auth_proof', methods: ['POST'])]
    public function prove(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'password' => Type\optional(Type\nullable(Type\string())),
            'provider' => Type\optional(Type\nullable(Type\backed_enum(IdentityProvider::class))),
            'providerSignIn' => Type\optional(ProviderAssertion::shape()),
            'code' => Type\optional(Type\mixed()),
            'pendingProof' => Type\optional(Type\nullable(Type\string())),
        ]));

        $provider = $body['provider'] ?? null;
        [$proof, $expiresAt] = $this->recentProof->prove(
            $this->user(),
            $body['password'] ?? null,
            null === $provider ? null : [$provider, $this->providerAssertion->claims($provider, $body['providerSignIn'] ?? [])],
            $this->codeField->optional($body, 'code', CodeField::FROM_APP_OR_RECOVERY),
            $body['pendingProof'] ?? null,
        );

        return new JsonResponse(['proof' => $proof, 'expiresAt' => $expiresAt->format(\DATE_ATOM)]);
    }

    /** The provider's sign-in, run while signed in, with the proof from `/api/auth/proof`. */
    #[Route('/api/auth/providers/{provider}', name: 'auth_provider_link', requirements: ['provider' => 'google|apple'], methods: ['POST'])]
    public function link(Request $request, string $provider): JsonResponse
    {
        $identityProvider = IdentityProvider::from($provider);
        $body = Input::body($request, Type\shape([
            'proof' => Type\optional(Type\nullable(Type\string())),
            'providerSignIn' => Type\optional(ProviderAssertion::shape()),
        ]));

        // The proof first: a stale one must not spend a provider's one-time code.
        $this->recentProof->require($this->user(), $body['proof'] ?? null);
        $claims = $this->providerAssertion->claims($identityProvider, $body['providerSignIn'] ?? []);
        $identity = $this->providerLinking->link($this->user(), $identityProvider, $claims, $body['proof'] ?? null, $request);

        return new JsonResponse(['provider' => $identity->getProvider()->value, 'email' => $identity->getEmail()], Response::HTTP_CREATED);
    }

    /** `sessionId` names the caller's own session, so the answer can say whether this device is one of those signed out. */
    #[Route('/api/auth/providers/{provider}/unlink', name: 'auth_provider_unlink', requirements: ['provider' => 'google|apple'], methods: ['POST'])]
    public function unlink(Request $request, string $provider): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'proof' => Type\optional(Type\nullable(Type\string())),
        ]));

        return new JsonResponse($this->providerLinking->unlink(
            $this->user(),
            IdentityProvider::from($provider),
            $body['proof'] ?? null,
            $this->callerSession->chain(),
            $request,
        ));
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        if (!$user instanceof User) {
            throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
        }

        return $user;
    }
}
