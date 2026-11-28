<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\SingleSignOn\SingleSignIn;
use App\Domain\Organisation\SingleSignOn\TestSignOn;
use App\Domain\User\TokenIssuer;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
use App\Repository\SsoAttemptRepository;
use Psl\Str;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Where the identity provider sends the browser back (sc-610). Anybody may arrive: only a state we issued does anything, and the way on is configured, never sent. */
#[PublicAccess]
final readonly class SingleSignOnCallbackController
{
    public function __construct(
        private OrganisationRepository $organisationRepository,
        private TestSignOn $testSignOn,
        private SingleSignIn $singleSignIn,
        private SsoAttemptRepository $ssoAttemptRepository,
        private string $webOrigin,
    ) {
    }

    #[Route('/api/sso/oidc/{organisationId}/callback', name: 'sso_oidc_callback', requirements: ['organisationId' => '[0-9a-f-]{36}'], methods: ['GET'])]
    public function oidc(Request $request, string $organisationId): RedirectResponse
    {
        $organisation = $this->organisationRepository->find($organisationId) ?? throw ApiException::notFound('access.not_found');
        $query = static function (string $name) use ($request): ?string {
            $value = $request->query->all()[$name] ?? null;

            return \is_string($value) && '' !== $value ? $value : null;
        };
        $state = $query('state') ?? '';
        $said = $query('error_description') ?? $query('error');
        $attempt = $this->ssoAttemptRepository->findOneBy(['stateHash' => TokenIssuer::hash($state)]);

        if (null !== $attempt?->getClientChallenge() && $attempt->getProvider()->getOrganisation()->getId()->equals($organisation->getId())) {
            $handle = $this->singleSignIn->receive($attempt, $query('code'), $said, $request);

            return $this->onTo('/sign-in/sso?' . \http_build_query(null === $handle ? ['error' => 'failed'] : ['handle' => $handle]));
        }

        $this->testSignOn->answer($organisation, $state, $query('code'), $said);

        return $this->onTo('/app/settings/sign-in-rules/single-sign-on');
    }

    private function onTo(string $path): RedirectResponse
    {
        return new RedirectResponse(Str\trim_right($this->webOrigin, '/') . $path, Response::HTTP_SEE_OTHER);
    }
}
