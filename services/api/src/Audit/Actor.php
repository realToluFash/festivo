<?php

declare(strict_types=1);

namespace App\Audit;

/**
 * Who did a thing.
 *
 * A support agent's action must be distinguishable from the account holder's
 * own. An agent action that cannot be told apart from a user's is
 * indistinguishable from a breach, and the moment that distinction matters is
 * the moment nobody can add it retroactively.
 */
enum Actor: string
{
    case User = 'user';
    case Agent = 'agent';
    case System = 'system';
    case ApiClient = 'api_client';
}
