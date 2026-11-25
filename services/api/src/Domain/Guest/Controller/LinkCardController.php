<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Link\LinkCard;
use App\Http\Access\Policy\PublicAccess;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final readonly class LinkCardController
{
    public function __construct(
        private LinkCard $linkCard,
    ) {
    }

    /** Asked by the web's nginx as it serves `/i/{token}` (sc-89272). The token comes in a header, so no log keeps it; records nothing (RFC 9110 §9.2.1). */
    #[Route('/api/guest-links/card', name: 'guest_links_card', methods: ['GET'])]
    #[PublicAccess]
    public function card(Request $request): Response
    {
        return new Response($this->linkCard->head($request->headers->get('X-Guest-Link') ?? ''), headers: [
            'Content-Type' => 'text/html; charset=utf-8',
            'Cache-Control' => 'no-store',
        ]);
    }
}
