<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\Input;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Type;
use Symfony\Component\HttpFoundation\Request;

/**
 * The boundary, including every way through it that must fail.
 *
 * The passing cases are the cheap half. What this file is for is the failures:
 * each one is a shape PHP would have accepted and coerced, and the previous
 * build shipped the consequences.
 */
final class InputTest extends TestCase
{
    #[Test]
    public function aBodyMatchingTheShapeComesBackTyped(): void
    {
        $request = Request::create('/x', 'POST', content: '{"name":"Ada","seats":4}');

        $input = Input::body($request, Type\shape([
            'name' => Type\string(),
            'seats' => Type\int(),
        ]));

        self::assertSame('Ada', $input['name']);
        self::assertSame(4, $input['seats']);
    }

    #[Test]
    public function anUnreadableBodyIsABadRequestRatherThanAFieldError(): void
    {
        $request = Request::create('/x', 'POST', content: '{"name": ');

        // 400, not 422: there is no field to blame when the body could not be
        // parsed at all, and a violation pointing at nothing is worse than none.
        $e = $this->refused($request, Type\shape(['name' => Type\string()]));

        self::assertSame(ErrorCode::BadRequest, $e->errorCode);
        self::assertSame([], $e->violations);
    }

    #[Test]
    public function anEmptyBodyIsABadRequest(): void
    {
        $e = $this->refused(
            Request::create('/x', 'POST', content: '   '),
            Type\shape(['name' => Type\string()]),
        );

        self::assertSame(ErrorCode::BadRequest, $e->errorCode);
    }

    #[Test]
    public function aWrongShapeIsAValidationFailureNamingTheField(): void
    {
        $request = Request::create('/x', 'POST', content: '{"name":"Ada","seats":"four"}');

        $e = $this->refused($request, Type\shape([
            'name' => Type\string(),
            'seats' => Type\int(),
        ]));

        self::assertSame(ErrorCode::ValidationFailed, $e->errorCode);
        self::assertSame('seats', $e->violations[0]['propertyPath']);
        self::assertSame('invalid_shape', $e->violations[0]['code']);
        self::assertSame(ShapeRefusal::FIELD, $e->violations[0]['message']);
    }

    #[Test]
    public function aFieldNamedWithItsOwnRefusalIsRefusedWithIt(): void
    {
        $request = Request::create('/x', 'POST', content: '{"countryCode":null}');
        $shape = Type\shape(['countryCode' => Type\string()]);

        try {
            Input::body($request, $shape, ['countryCode' => 'validation.country_invalid']);
            self::fail('Expected the input to be refused.');
        } catch (ShapeRefusal $e) {
            self::assertSame('countryCode', $e->propertyPath);
            self::assertSame('validation.country_invalid', $e->refusal);
        }
    }

    #[Test]
    public function aNestedFailureNamesTheWholePath(): void
    {
        $request = Request::create('/x', 'POST', content: '{"venue":{"address":{"postcode":[]}}}');

        $e = $this->refused($request, Type\shape([
            'venue' => Type\shape([
                'address' => Type\shape(['postcode' => Type\string()]),
            ]),
        ]));

        self::assertSame('venue.address.postcode', $e->violations[0]['propertyPath']);
    }

    /**
     * The one that cost a day.
     *
     * A null reaching a declared `string` is coerced to `''` by PHP under
     * non-strict types and read as data several frames later. Here it is
     * refused at the edge, named.
     */
    #[Test]
    public function aNullWhereAStringWasDeclaredIsRefusedRatherThanCoercedToEmpty(): void
    {
        $request = Request::create('/x', 'POST', content: '{"country":null}');

        $e = $this->refused($request, Type\shape(['country' => Type\string()]));

        self::assertSame(ErrorCode::ValidationFailed, $e->errorCode);
        self::assertSame('country', $e->violations[0]['propertyPath']);
    }

    /** A nullable field is a different declaration, and it accepts the null. */
    #[Test]
    public function aFieldDeclaredNullableAcceptsTheNull(): void
    {
        $request = Request::create('/x', 'POST', content: '{"country":null}');

        $input = Input::body($request, Type\shape(['country' => Type\nullable(Type\string())]));

        self::assertNull($input['country']);
    }

    #[Test]
    public function anAbsentOptionalKeyIsAbsentRatherThanNull(): void
    {
        $input = Input::query(
            Request::create('/x?q=london'),
            Type\shape([
                'q' => Type\optional(Type\string()),
                'country' => Type\optional(Type\string()),
            ]),
        );

        self::assertSame('london', $input['q'] ?? null);
        self::assertArrayNotHasKey('country', $input);
    }

    /**
     * Query values are always strings, so declaring an int is doing real work:
     * it reads "5" as 5 and refuses "five", where `(int) 'five'` is 0 — a
     * number the client never sent and cannot be told it was given.
     */
    #[Test]
    public function aNumericQueryValueCoercesAndANonNumericOneIsRefused(): void
    {
        $shape = Type\shape(['limit' => Type\int()], allowUnknownFields: true);

        self::assertSame(5, Input::query(Request::create('/x?limit=5'), $shape)['limit']);

        $e = $this->refused(Request::create('/x?limit=five'), $shape, body: false);
        self::assertSame('limit', $e->violations[0]['propertyPath']);
    }

    /**
     * A closed shape — the default — DROPS an undeclared field rather than
     * refusing it. That is the behaviour we want at a boundary and the reason
     * shapes here are closed: a client appending a tracking parameter is not
     * an error, and the handler receives declared keys only, so there is
     * nothing undeclared to mass-assign even if somebody forwards the array.
     */
    #[Test]
    public function aClosedShapeDropsAnUndeclaredField(): void
    {
        $input = Input::query(
            Request::create('/x?q=london&utm_source=email'),
            Type\shape(['q' => Type\string()]),
        );

        self::assertSame(['q' => 'london'], $input);
    }

    /**
     * The opposite flag, asserted so nobody has to guess which way round it is.
     *
     * `allowUnknownFields: true` KEEPS what the shape did not declare. It is
     * for passing a payload onwards intact, and it is the wrong default for a
     * request: a handler that spread this array into an entity would be
     * assigning whatever the client chose to send.
     */
    #[Test]
    public function anOpenShapeKeepsAnUndeclaredField(): void
    {
        $request = Request::create('/x', 'POST', content: '{"name":"Ada","guestName":"Ada"}');

        $input = Input::body($request, Type\shape(['name' => Type\string()], allowUnknownFields: true));

        self::assertSame('Ada', $input['name']);
        self::assertArrayHasKey('guestName', $input);
    }

    /**
     * JSON has a single number type, so a latitude the client sent as `51`
     * decodes to an int. That is the declared float, not a coercion of it.
     */
    #[Test]
    public function aJsonIntegerSatisfiesADeclaredFloat(): void
    {
        $request = Request::create('/x', 'POST', content: '{"latitude":51,"longitude":null}');

        $input = Input::body($request, Type\shape([
            'latitude' => Type\float(),
            'longitude' => Type\nullable(Type\float()),
        ]));

        self::assertSame(51.0, $input['latitude']);
        self::assertNull($input['longitude']);
    }

    /** @return iterable<string, array{string, int}> */
    public static function wholeNumbersWrittenAsFloats(): iterable
    {
        yield 'a zero fraction' => ['30.0', 30];
        yield 'exponent form' => ['3e1', 30];
        yield 'exponent form with a fraction' => ['3.0E1', 30];
        yield 'a fraction finer than a double holds' => ['30.0000000000000001', 30];
        yield 'a negative zero fraction' => ['-7.0', -7];
        yield 'the lowest integer' => ['-9223372036854775808.0', \PHP_INT_MIN];
    }

    /** A JSON number is one type, so 30.0 is the number 30 however it is written (sc-10158). */
    #[Test]
    #[DataProvider('wholeNumbersWrittenAsFloats')]
    public function aWholeNumberWrittenAsAFloatSatisfiesADeclaredInt(string $value, int $read): void
    {
        $request = Request::create('/x', 'POST', content: '{"days":' . $value . ',"limit":' . $value . '}');

        $input = Input::body($request, Type\shape([
            'days' => Type\int(),
            'limit' => Type\nullable(Type\int()),
        ]));

        self::assertSame([$read, $read], [$input['days'], $input['limit']]);
    }

    /** @return iterable<string, array{string, Type\TypeInterface<mixed>}> */
    public static function valuesOfAnotherJsonType(): iterable
    {
        yield 'a number for a string' => ['42', Type\string()];
        yield 'a fraction for a string' => ['4.5', Type\string()];
        yield 'a number past the integer range for a string' => ['12345678901234567890', Type\string()];
        yield 'a boolean for a string' => ['true', Type\string()];
        yield 'a list for a string' => ['["a"]', Type\string()];
        yield 'an object for a string' => ['{"a":"b"}', Type\string()];
        yield 'a numeric string for an int' => ['"30"', Type\int()];
        yield 'a numeric string for a nullable int' => ['"30"', Type\nullable(Type\int())];
        yield 'a fraction for an int' => ['30.5', Type\int()];
        yield 'a fraction for a nullable int' => ['7.25', Type\nullable(Type\int())];
        yield 'the finest fraction a double holds near 30 for an int' => ['30.00000000000001', Type\int()];
        yield 'a whole number past the integer range in exponent form for an int' => ['1e20', Type\int()];
        yield 'a whole number past the integer range for an int' => ['12345678901234567890', Type\int()];
        yield 'two to the sixty-third for an int' => ['9223372036854775808', Type\int()];
        yield 'a whole number below the integer range for an int' => ['-1e19', Type\int()];
        yield 'a whole number written with a fraction for a string' => ['42.0', Type\string()];
        yield 'a whole number written with a fraction for a boolean' => ['1.0', Type\bool()];
        yield 'a numeric string for a float' => ['"5"', Type\float()];
        yield '0 for a boolean' => ['0', Type\bool()];
        yield '1 for a boolean' => ['1', Type\bool()];
        yield '"true" for a boolean' => ['"true"', Type\bool()];
        yield '"false" for an optional boolean' => ['"false"', Type\optional(Type\bool())];
        yield 'an object for a list' => ['{"a":"b"}', Type\vec(Type\string())];
        yield 'a number for a string-backed enum' => ['1', Type\backed_enum(ErrorCode::class)];
    }

    /**
     * @param Type\TypeInterface<mixed> $field
     */
    #[Test]
    #[DataProvider('valuesOfAnotherJsonType')]
    public function aJsonValueOfAnotherTypeIsRefusedRatherThanCoerced(string $value, Type\TypeInterface $field): void
    {
        $request = Request::create('/x', 'POST', content: '{"field":' . $value . '}');

        $e = $this->refused($request, Type\shape(['field' => $field]));

        self::assertSame(ErrorCode::ValidationFailed, $e->errorCode);
        self::assertSame('field', $e->violations[0]['propertyPath']);
        self::assertSame('invalid_shape', $e->violations[0]['code']);
        self::assertSame(ShapeRefusal::FIELD, $e->violations[0]['message']);
    }

    #[Test]
    public function aNumberForAFieldWithItsOwnRefusalIsRefusedWithIt(): void
    {
        $request = Request::create('/x', 'POST', content: '{"countryCode":42}');

        try {
            Input::body($request, Type\shape(['countryCode' => Type\string()]), ['countryCode' => 'validation.country_invalid']);
            self::fail('Expected the input to be refused.');
        } catch (ShapeRefusal $e) {
            self::assertSame('countryCode', $e->propertyPath);
            self::assertSame('validation.country_invalid', $e->refusal);
        }
    }

    #[Test]
    public function aNestedValueOfAnotherTypeNamesTheWholePath(): void
    {
        $request = Request::create('/x', 'POST', content: '{"venue":{"rooms":[{"name":"Hall"},{"name":7}]}}');

        $e = $this->refused($request, Type\shape([
            'venue' => Type\shape([
                'rooms' => Type\vec(Type\shape(['name' => Type\string()])),
            ]),
        ]));

        self::assertSame('venue.rooms.1.name', $e->violations[0]['propertyPath']);
    }

    #[Test]
    public function anEnumIsReadFromItsBackingValue(): void
    {
        $request = Request::create('/x', 'POST', content: '{"error":"bad_request"}');

        $input = Input::body($request, Type\shape(['error' => Type\backed_enum(ErrorCode::class)]));

        self::assertSame(ErrorCode::BadRequest, $input['error']);
    }

    /**
     * @param Type\TypeInterface<mixed> $shape
     */
    private function refused(Request $request, Type\TypeInterface $shape, bool $body = true): ApiException
    {
        try {
            $body ? Input::body($request, $shape) : Input::query($request, $shape);
        } catch (ApiException $e) {
            return $e;
        }

        self::fail('Expected the input to be refused.');
    }
}
