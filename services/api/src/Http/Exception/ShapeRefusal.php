<?php

declare(strict_types=1);

namespace App\Http\Exception;

use App\Enum\ErrorCode;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

// Thrown where no translator reaches, so it carries keys and is worded when the
// problem is rendered. The parser's own message is never one of them.
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

    public function in(TranslatorInterface $translator, ?string $locale): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => $this->propertyPath,
            'message' => $translator->trans($this->refusal, [], null, $locale),
            'code' => 'invalid_shape',
        ]], $translator->trans(self::REQUEST, [], null, $locale));
    }
}
