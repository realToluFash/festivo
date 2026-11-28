<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\SingleSignOn\TestSignOn;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
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
        $this->testSignOn->answer($organisation, $query('state') ?? '', $query('code'), $query('error_description') ?? $query('error'));

        return new RedirectResponse(Str\trim_right($this->webOrigin, '/') . '/app/settings/sign-in-rules/single-sign-on', Response::HTTP_SEE_OTHER);
    }
}
