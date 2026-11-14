<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use App\Http\EntityTag;
use Psl\Str;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/** A written calendar as a calendar app fetches it: tagged by its own bytes, so a refresh that finds nothing changed is a 304. */
final class CalendarFeedResponse
{
    public static function of(Request $request, string $body): Response
    {
        $tag = '"' . Str\slice(\hash('sha256', $body), 0, 32) . '"';
        $headers = ['ETag' => $tag, 'Cache-Control' => 'private, no-cache'];
        $ifNoneMatch = $request->headers->get('If-None-Match');

        if (null !== $ifNoneMatch && ('*' === Str\trim($ifNoneMatch) || EntityTag::matches($ifNoneMatch, $tag))) {
            return new Response(null, Response::HTTP_NOT_MODIFIED, $headers);
        }

        return new Response($body, Response::HTTP_OK, [...$headers, 'Content-Type' => 'text/calendar; charset=utf-8']);
    }
}
