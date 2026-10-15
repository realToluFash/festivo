<?php

declare(strict_types=1);

namespace App\Domain\User\Password;

use App\Domain\User\Interfaces\BreachedPasswordCheckerInterface;
use Psl\Iter;
use SensitiveParameter;

/**
 * The stand-in for the breach corpus, following the same pattern as
 * ScriptedAssistant: a deterministic implementation of the port that the suite
 * uses so no test reaches a third party.
 *
 * The list is the most common passwords that are also long enough to pass the
 * length rule, because a password refused for being short never reaches the
 * corpus and a test using one would prove nothing.
 */
final readonly class ScriptedBreachedPasswordChecker implements BreachedPasswordCheckerInterface
{
    public const array KNOWN = [
        'password1234',
        'qwertyuiop123',
        'iloveyou1234',
        'administrator',
        'letmein12345',
    ];

    public function isBreached(#[SensitiveParameter] string $password): bool
    {
        return Iter\contains(self::KNOWN, PasswordPolicy::normalise($password));
    }
}
