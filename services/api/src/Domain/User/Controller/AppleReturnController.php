<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Provider\AppleAppReturn;
use App\Http\Access\Policy\PublicAccess;
use Psl\Str;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

// Apple posts its answer here (form_post). An app's attempt goes back to the app by its App Link with a
// one-time handle; anything else goes on to the web's callback. Both targets are configured, never sent.
#[PublicAccess]
final readonly class AppleReturnController
{
    public function __construct(
        private string $webOrigin,
        private string $appleAppLink,
        private AppleAppReturn $appleAppReturn,
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

        $appLinkQuery = isset($carried['state']) ? $this->appleAppReturn->receive($carried['state'], $carried['code'] ?? null, $carried['user'] ?? null) : null;

        if (null !== $appLinkQuery) {
            return new RedirectResponse($this->appleAppLink . '?' . \http_build_query($appLinkQuery), Response::HTTP_SEE_OTHER);
        }

        return new RedirectResponse(
            Str\trim_right($this->webOrigin, '/') . '/oauth/apple?' . \http_build_query($carried),
            Response::HTTP_SEE_OTHER,
        );
    }
}
