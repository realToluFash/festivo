<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Iter;
use Psl\Str;
use ReflectionClass;
use ReflectionMethod;
use ReflectionNamedType;
use SensitiveParameter;
use Symfony\Component\Finder\Finder;

/**
 * Every parameter that carries a secret is marked, across the whole of src.
 *
 * A password leaks through a stack trace rather than through a log line
 * somebody wrote on purpose: an uncaught exception's trace includes argument
 * values, and #[SensitiveParameter] is what replaces one with a placeholder.
 * The regression is a method added later without it, which produces no error
 * and fails nothing else.
 *
 * `mago lint`'s sensitive-parameter rule covers the same ground and found four
 * of these before this test did — which is why this walks the source rather
 * than naming methods. A hand-written list of places to check is a list with
 * something missing from it.
 */
final class SensitiveParametersTest extends TestCase
{
    /**
     * Names that mean "this value must not be seen". Matched as substrings, so
     * `$apiKey`, `$passwordHash` and `$refreshToken` are all caught.
     */
    private const array SENSITIVE = ['password', 'secret', 'apikey', 'passphrase', 'credential', 'token'];

    /**
     * A hash is already a one-way function of the secret and a token id is not
     * the token. Listed rather than inferred, because each is a deliberate
     * judgement about one name.
     */
    private const array NOT_SENSITIVE = ['tokenhash', 'passwordhash', 'tokenid', 'tokensoffered'];

    #[Test]
    public function everySecretCarryingParameterIsMarked(): void
    {
        $unmarked = [];

        foreach (self::classes() as $class) {
            foreach (new ReflectionClass($class)->getMethods() as $method) {
                if ($method->getDeclaringClass()->getName() !== $class) {
                    continue;
                }

                foreach (self::unmarkedIn($method) as $parameter) {
                    $unmarked[] = $class . '::' . $method->getName() . '($' . $parameter . ')';
                }
            }
        }

        self::assertSame(
            [],
            $unmarked,
            "Takes a secret without #[SensitiveParameter]:\n  " . Str\join($unmarked, "\n  "),
        );
    }

    /**
     * The guard itself. A test that cannot fail protects nothing, and this one
     * could stop matching if the name list or the reflection walk broke.
     */
    #[Test]
    public function theGuardRecognisesAnUnmarkedSecret(): void
    {
        $probe = new class {
            /**
             * Unmarked on purpose: this is the shape the guard above exists to
             * catch, so marking it would make the test pass for the wrong
             * reason. mago's own rule finds the same thing, which is the point.
             *
             * @mago-expect lint:sensitive-parameter
             */
            public function take(string $password, string $other): void
            {
            }
        };

        $method = new ReflectionMethod($probe, 'take');

        self::assertSame(['password'], \iterator_to_array(self::unmarkedIn($method), false));
    }

    #[Test]
    public function theGuardAcceptsAMarkedSecret(): void
    {
        $probe = new class {
            public function take(#[SensitiveParameter] string $password): void
            {
            }
        };

        self::assertSame([], \iterator_to_array(self::unmarkedIn(new ReflectionMethod($probe, 'take')), false));
    }

    /** @return iterable<string> */
    private static function unmarkedIn(ReflectionMethod $method): iterable
    {
        foreach ($method->getParameters() as $parameter) {
            $type = $parameter->getType();

            if (!$type instanceof ReflectionNamedType || 'string' !== $type->getName()) {
                continue;
            }

            $name = Str\lowercase($parameter->getName());

            if (Iter\contains(self::NOT_SENSITIVE, $name)) {
                continue;
            }

            $looksSensitive = false;
            foreach (self::SENSITIVE as $needle) {
                if (Str\contains($name, $needle)) {
                    $looksSensitive = true;
                    break;
                }
            }

            if ($looksSensitive && [] === $parameter->getAttributes(SensitiveParameter::class)) {
                yield $parameter->getName();
            }
        }
    }

    /** @return list<class-string> */
    private static function classes(): array
    {
        $root = \dirname(__DIR__, 2) . '/src';
        $found = [];

        foreach (new Finder()->files()->in($root)->name('*.php') as $file) {
            $relative = Str\replace($file->getRelativePathname(), '/', '\\');
            $class = 'App\\' . Str\strip_suffix($relative, '.php');

            if (\class_exists($class) || \interface_exists($class)) {
                $found[] = $class;
            }
        }

        return $found;
    }
}
