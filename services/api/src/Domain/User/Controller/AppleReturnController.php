<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Http\Access\Policy\PublicAccess;
use Psl\Str;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

// Apple posts its answer here (form_post), which a page cannot receive, and the browser goes on to the
// web's callback with the same values: only to our configured web origin, so never an open redirect.
#[PublicAccess]
final readonly class AppleReturnController
{
    public function __construct(
        private string $webOrigin,
    ) {
    }

    #[Route('/api/auth/oauth/apple/return', name: 'auth_oauth_apple_return', methods: ['POST'])]
    public function return(Request $request): RedirectResponse
    {
        $carried = [];

        foreach (['code', 'state', 'user', 'error'] as $field) {
            $value = $request->request->get($field);

            if (\is_string($value) && '' !== $value) {
                $carried[$field] = $value;
            }
        }

        return new RedirectResponse(
            Str\trim_right($this->webOrigin, '/') . '/oauth/apple?' . \http_build_query($carried),
            Response::HTTP_SEE_OTHER,
        );
    }
}
