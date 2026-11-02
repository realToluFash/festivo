<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Http\ProblemRenderer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Dict;
use Psl\File;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/** sc-10700: a sentence written where a refusal is thrown is English under every title. */
final class RefusalsAreKeyedTest extends TestCase
{
    private const string HEAD = <<<'PHP'
        <?php

        namespace App\Refused;

        use App\Enum\ErrorCode;
        use App\Http\Exception\ApiException;
        use Psl\Str;

        final class Refuses
        {

        PHP;

    private const array BUILDING = ['Http/Exception/ApiException.php', 'Http/ProblemRenderer.php', 'Domain/User/Attempts/GuardedAttempt.php'];

    /** @var array<string, string>|null */
    private static ?array $source = null;

    /** @var array<string, RefusalScan> */
    private static array $scans = [];

    #[Test]
    public function noRefusalIsGivenASentence(): void
    {
        $scan = self::scan();

        self::assertNotEmpty($scan->literals(), 'No refusal found at all: the scan is broken.');
        self::assertSame([], $scan->sentences(), 'Give these refusals a key in translations/messages.*.json instead.');
    }

    #[Test]
    public function everyKeyARefusalIsGivenIsInTheCatalogue(): void
    {
        self::assertSame([], self::missing(self::scan()), 'These keys are not in translations/messages.en.json.');
    }

    /** @return iterable<string, array{string, string}> a key each refusal builder in src is handed, in the file that hands it */
    public static function builders(): iterable
    {
        yield 'EventRules::violation' => ['Domain/Event/EventRules.php', 'validation.event_name_required'];
        yield 'OrganisationRules::violation' => ['Domain/Organisation/OrganisationRules.php', 'validation.organisation_name_required'];
        yield 'UserRegistrar::violation' => ['Domain/User/UserRegistrar.php', 'validation.email_invalid'];
        yield 'AccountName::nameViolation' => ['Domain/User/AccountName.php', 'validation.name_required'];
        yield 'RoleManager::invalid' => ['Domain/Organisation/Roles/RoleManager.php', 'roles.name_builtin'];
        yield 'InvitationSender::invalid' => ['Domain/Organisation/Invitations/InvitationSender.php', 'validation.invite_email_required'];
        yield 'LinkedContacts::refusal' => ['Domain/User/Contacts/LinkedContacts.php', 'contacts.already_linked'];
        yield 'PhoneNumberParser::refusal' => ['Domain/User/Phone/PhoneNumberParser.php', 'validation.phone_required'];
        yield 'CodeField::refused' => ['Http/CodeField.php', 'validation.code_email_required'];
        yield 'OwnerCheck::require' => ['Domain/Organisation/Controller/DeletionController.php', 'organisation.owner_required'];
        yield 'NewPasswordRules' => ['Domain/User/Password/NewPasswordRules.php', 'validation.password_too_short'];
        yield 'PasswordChange' => ['Domain/User/Password/PasswordChange.php', 'validation.password_unchanged'];
    }

    #[Test]
    #[DataProvider('builders')]
    public function aSentenceHandedToARealBuilderFailsTheCheck(string $file): void
    {
        $scan = self::scan('Not yours.');

        self::assertNotEmpty(Vec\filter($scan->sentences(), static fn (string $leaf): bool => Str\starts_with($leaf, $file . ':') && 'Not yours.' === RefusalScan::text($leaf)));
    }

    #[Test]
    #[DataProvider('builders')]
    public function aKeyHandedToARealBuilderMustBeInTheCatalogue(string $file): void
    {
        $scan = self::scan('organisation.no_such_key');

        self::assertNotEmpty(Vec\filter(self::missing($scan), static fn (string $leaf): bool => Str\starts_with($leaf, $file . ':') && 'organisation.no_such_key' === RefusalScan::text($leaf)));
    }

    /** @return iterable<string, array{string, string}> a refusal added under src, and what the check says about it */
    public static function refusals(): iterable
    {
        yield 'a literal' => [
            "public function a(): never { throw ApiException::forbidden('Not yours.'); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'one word' => [
            "public function a(): never { throw new ApiException(ErrorCode::Forbidden, 'Forbidden.'); }",
            'Refused.php:11 Forbidden.',
        ];
        yield 'formatted with Str\format' => [
            "public function a(string \$p): never { throw ApiException::forbidden(Str\\format('This needs the %s permission.', \$p)); }",
            'Refused.php:11 This needs the %s permission.',
        ];
        yield 'formatted with sprintf' => [
            "public function a(int \$n): never { throw new ApiException(ErrorCode::BadRequest, \\sprintf('At most %d.', \$n)); }",
            'Refused.php:11 At most %d.',
        ];
        yield 'interpolated' => [
            'public function a(string $x): never { throw ApiException::conflict("Not yours, {$x}."); }',
            'Refused.php:11 Not yours, {…}.',
        ];
        yield 'joined' => [
            "public function a(string \$x): never { throw ApiException::conflict('Not yours. ' . \$x); }",
            'Refused.php:11 Not yours. ',
        ];
        yield 'held in a variable' => [
            "public function a(): never { \$why = 'Not yours.'; throw ApiException::forbidden(\$why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'held in a constant' => [
            "private const string WHY = 'Not yours.';\npublic function a(): never { throw ApiException::forbidden(self::WHY); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'returned by a method' => [
            "public function a(): never { throw ApiException::forbidden(\$this->why()); }\nprivate function why(): string { return 'Not yours.'; }",
            'Refused.php:12 Not yours.',
        ];
        yield 'passed through a helper that throws it' => [
            "public function a(): never { \$this->refuse('Not yours.'); }\nprivate function refuse(string \$why): never { throw new ApiException(ErrorCode::Forbidden, \$why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'passed through two helpers' => [
            "public function a(): never { \$this->refuse('Not yours.'); }\nprivate function refuse(string \$why): never { throw \$this->refusal(\$why); }\nprivate function refusal(string \$why): ApiException { return ApiException::forbidden(\$why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'a guarded attempt' => [
            "public function a(\\App\\Domain\\User\\Attempts\\GuardedAttempt \$g): void { \$g->attempt(static fn () => null, static fn () => [], static fn () => null, 'Too many tries.'); }",
            'Refused.php:11 Too many tries.',
        ];
        yield 'a field message' => [
            "public function a(): never { throw ApiException::validation([['propertyPath' => 'x', 'message' => 'Choose one.', 'code' => 'x']]); }",
            'Refused.php:11 Choose one.',
        ];
        yield 'a field message formatted' => [
            "public function a(int \$n): never { throw ApiException::validation([['propertyPath' => 'x', 'message' => \\sprintf('At most %d.', \$n), 'code' => 'x']]); }",
            'Refused.php:11 At most %d.',
        ];
        yield 'a field message mapped in' => [
            "public function a(int \$n): never { \$o = []; \$o['x'] = \\sprintf('At most %d.', \$n);\nthrow ApiException::validation(\\array_map(static fn (string \$p, string \$m): array => ['propertyPath' => \$p, 'message' => \$m, 'code' => 'x'], \\array_keys(\$o), \\array_values(\$o))); }",
            'Refused.php:11 At most %d.',
        ];
        yield 'translated by a helper' => [
            "public function a(): never { \$this->refuse('Not yours.'); }\nprivate function refuse(string \$key): never { throw new ApiException(ErrorCode::Forbidden, \$this->translator->trans(\$key)); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'a field message translated by a helper' => [
            "public function a(): never { throw ApiException::validation([\$this->violation('x', 'Choose one.')]); }\nprivate function violation(string \$p, string \$key): array { return ['propertyPath' => \$p, 'message' => \$this->translator->trans(\$key), 'code' => 'x']; }",
            'Refused.php:11 Choose one.',
        ];
        yield 'joined on with .=' => [
            "public function a(): never { \$why = ''; \$why .= 'Not yours.'; throw ApiException::forbidden(\$why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'filled in with ??=' => [
            "public function a(?string \$why): never { \$why ??= 'Not yours.'; throw ApiException::forbidden(\$why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'a parameter\'s default' => [
            "public function a(): never { throw new Gone(); }\n}\nfinal class Gone extends ApiException\n{\npublic function __construct(string \$why = 'Not yours.') { parent::__construct(ErrorCode::Forbidden, \$why); }",
            'Refused.php:15 Not yours.',
        ];
        yield 'held in a static property' => [
            "private static string \$why = 'Not yours.';\npublic function a(): never { throw ApiException::forbidden(self::\$why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'assigned to a static property' => [
            "private static string \$why = '';\npublic function a(): never { self::\$why = 'Not yours.'; throw ApiException::forbidden(self::\$why); }",
            'Refused.php:12 Not yours.',
        ];
        yield 'held in a property' => [
            "private string \$why = 'Not yours.';\npublic function a(): never { throw ApiException::forbidden(\$this->why); }",
            'Refused.php:11 Not yours.',
        ];
        yield 'handed to the renderer' => [
            "public function a(\\App\\Http\\ProblemRenderer \$r, \\Symfony\\Component\\HttpFoundation\\Request \$q): void { \$r->render(\$q, ErrorCode::Unauthenticated, 'Please sign in.'); }",
            'Refused.php:11 Please sign in.',
        ];
    }

    #[Test]
    #[DataProvider('refusals')]
    public function aSentenceAddedUnderSrcFailsTheCheck(string $code, string $reported): void
    {
        $scan = new RefusalScan([...Dict\select_keys(self::source(), self::BUILDING), 'Refused.php' => self::HEAD . $code . "\n}\n"]);

        self::assertContains($reported, $scan->sentences());
    }

    #[Test]
    public function aServerErrorsSentenceIsLeftAlone(): void
    {
        $code = "public function a(): never { throw new ApiException(ErrorCode::ServiceUnavailable, 'Lookups are down.'); }";
        $scan = new RefusalScan([...Dict\select_keys(self::source(), self::BUILDING), 'Refused.php' => self::HEAD . $code . "\n}\n"]);

        self::assertSame([], $scan->sentences());
    }

    /** @return list<string> each key a refusal is given that the catalogue does not hold */
    private static function missing(RefusalScan $scan): array
    {
        $catalogue = self::catalogue('messages') + self::catalogue('messages+intl-icu');

        return Vec\filter(
            $scan->literals(),
            static fn (string $leaf): bool => Regex\matches(RefusalScan::text($leaf), ProblemRenderer::KEY) && !Iter\contains_key($catalogue, RefusalScan::text($leaf)),
        );
    }

    /** A literal is a leaf of the scan, never an edge, so one scan with every builder's key swapped tests them all. */
    private static function scan(?string $instead = null): RefusalScan
    {
        $kind = $instead ?? '';
        if (Iter\contains_key(self::$scans, $kind)) {
            return self::$scans[$kind];
        }

        $source = self::source();
        foreach (null === $instead ? [] : self::builders() as [$file, $key]) {
            self::assertStringContainsString("'{$key}'", $source[$file]);
            $source[$file] = Str\replace_every($source[$file], ["'{$key}'" => "'{$instead}'"]);
        }

        return self::$scans[$kind] = new RefusalScan($source);
    }

    /** @return array<string, string> */
    private static function source(): array
    {
        if (null !== self::$source) {
            return self::$source;
        }

        $root = \dirname(__DIR__, 2) . '/src/';
        $source = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
            if ($file instanceof SplFileInfo && 'php' === $file->getExtension()) {
                $source[Str\strip_prefix($file->getPathname(), $root)] = File\read(Type\non_empty_string()->assert($file->getPathname()));
            }
        }

        return self::$source = Dict\sort_by_key($source);
    }

    /** @return array<string, string> */
    private static function catalogue(string $domain): array
    {
        $path = \dirname(__DIR__, 2) . "/translations/{$domain}.en.json";

        return Type\dict(Type\string(), Type\string())->assert(Json\decode(File\read($path)));
    }
}
