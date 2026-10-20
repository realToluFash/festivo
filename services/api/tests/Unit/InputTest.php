<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
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
     * Why bodies coerce rather than assert: JSON has a single number type, so a
     * latitude the client sent as `51` decodes to an int. Coercion reads it as
     * the declared float; a strict assertion would refuse a coordinate that was
     * sent correctly.
     */
    #[Test]
    public function aJsonIntegerSatisfiesADeclaredFloat(): void
    {
        $request = Request::create('/x', 'POST', content: '{"latitude":51}');

        $input = Input::body($request, Type\shape(['latitude' => Type\float()]));

        self::assertSame(51.0, $input['latitude']);
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
