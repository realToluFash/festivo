<?php

declare(strict_types=1);

namespace App\Http\Exception;

use App\Enum\ErrorCode;
use Throwable;

// It carries keys, never the parser's own message.
final class ShapeRefusal extends ApiException
{
    public const string FIELD = 'validation.invalid_shape';

    public const string REQUEST = 'validation.request_shape';

    public function __construct(
        public readonly string $propertyPath,
        public readonly string $refusal = self::FIELD,
        ?Throwable $previous = null,
    ) {
        parent::__construct(ErrorCode::ValidationFailed, self::REQUEST, [[
            'propertyPath' => $propertyPath,
            'message' => $refusal,
            'code' => 'invalid_shape',
        ]], $previous);
    }
}
