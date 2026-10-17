<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\User\Password\PasswordPolicy;
use App\Domain\User\Password\ScriptedBreachedPasswordChecker;
use App\Enum\PasswordFailure;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Str;
use SensitiveParameter;

/**
 * The password rules, which are NIST SP 800-63B's rather than ours.
 *
 * Most of what is asserted here is what the policy does NOT do. The composition
 * rules it declines to impose are the part somebody will eventually try to add
 * back, because "no uppercase required" reads like an oversight rather than a
 * decision.
 */
final class PasswordPolicyTest extends TestCase
{
    #[Test]
    #[DataProvider('acceptable')]
    public function itAcceptsWhatTheStandardSaysToAccept(#[SensitiveParameter] string $password, string $why): void
    {
        self::assertSame([], PasswordPolicy::check($password), $why);
    }

    /** @return iterable<string, array{string, string}> */
    public static function acceptable(): iterable
    {
        yield 'exactly the minimum' => ['abcdefghijklmno', '15 characters is the floor, not 16 (NIST SP 800-63B-4 §3.1.1.2)'];

        yield 'sixty-four characters' => [Str\repeat('a', 64), 'A verifier SHALL permit at least 64'];

        yield 'all lower case, no digit, no symbol' => [
            'correcthorsebatterystaple',
            'No composition rules. This is the point of the standard, not a gap in ours.',
        ];

        yield 'spaces throughout' => [
            'a passphrase with spaces',
            'Spaces are legitimate characters and must not be stripped or refused',
        ];

        yield 'leading and trailing space' => [
            '  twelve chars  ',
            'Trimming a password changes it, and the person typed what they typed',
        ];

        yield 'non-latin script' => ['пароль из слов двенадцать', 'Every printable character is allowed'];

        yield 'emoji' => ['🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉', 'Fifteen characters, whatever they are'];

        yield 'at the maximum' => [Str\repeat('a', PasswordPolicy::MAXIMUM_LENGTH), 'The cap is inclusive'];
    }

    #[Test]
    public function itRefusesSomethingShorterThanTheMinimum(): void
    {
        self::assertSame([PasswordFailure::TooShort], PasswordPolicy::check(Str\repeat('a', 14)));
    }

    /** A scripted breached password the length rule refuses never reaches the corpus, and its test proves nothing. */
    #[Test]
    public function everyScriptedBreachedPasswordIsLongEnoughToReachTheCorpus(): void
    {
        foreach (ScriptedBreachedPasswordChecker::KNOWN as $known) {
            self::assertSame([], PasswordPolicy::check($known), $known);
        }
    }

    #[Test]
    public function itRefusesSomethingLongerThanTheMaximum(): void
    {
        $password = Str\repeat('a', PasswordPolicy::MAXIMUM_LENGTH + 1);

        self::assertSame([PasswordFailure::TooLong], PasswordPolicy::check($password));
    }

    #[Test]
    public function anEmptyPasswordIsTooShortRatherThanSomethingElse(): void
    {
        self::assertSame([PasswordFailure::TooShort], PasswordPolicy::check(''));
    }

    /**
     * Length is counted in characters, not bytes. Counted in bytes, a twelve
     * character Cyrillic password measures 24 and passes a rule it should not,
     * and a Japanese one passes at four characters.
     */
    #[Test]
    public function lengthIsCountedInCharactersAndNotBytes(): void
    {
        $fourKanji = '日本語語';

        self::assertSame(12, Str\Byte\length($fourKanji), 'precondition: four characters, twelve bytes');
        self::assertSame([PasswordFailure::TooShort], PasswordPolicy::check($fourKanji));
    }

    /**
     * NFKC, so the same password typed on two keyboards is the same password.
     *
     * Fifteen composed accented characters and the thirty code points that
     * decompose to them have to behave identically, or somebody can set a
     * password on one device and be refused on another with a correct one.
     */
    #[Test]
    public function aDecomposedPasswordIsTheSameAsItsComposedForm(): void
    {
        $composed = Str\repeat("\u{00e9}", 15);
        $decomposed = Str\repeat("e\u{0301}", 15);

        self::assertNotSame($composed, $decomposed, 'precondition: different byte sequences');
        self::assertSame($composed, PasswordPolicy::normalise($decomposed), 'normalisation collapses them');
        self::assertSame([], PasswordPolicy::check($decomposed), 'and the length is measured on the result');
    }

    /**
     * The other direction of the same rule: fourteen decomposed characters are
     * fourteen characters, not twenty-eight, so they are still too short.
     */
    #[Test]
    public function normalisationDoesNotLetAShortPasswordThrough(): void
    {
        self::assertSame([PasswordFailure::TooShort], PasswordPolicy::check(Str\repeat("e\u{0301}", 14)));
    }

    #[Test]
    public function malformedTextIsRefusedForItsLengthRatherThanThrowing(): void
    {
        $broken = "\xC3\x28" . Str\repeat('a', 14);

        self::assertSame([], PasswordPolicy::check($broken), 'long enough, and normalisation declined to touch it');
    }
}
