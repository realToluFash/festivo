<?php

declare(strict_types=1);

namespace App\Http\OpenApi;

use ApiPlatform\OpenApi\Factory\OpenApiFactoryInterface;
use ApiPlatform\OpenApi\OpenApi;
use App\Enum\TableShape;
use ArrayObject;
use Psl\Vec;
use Symfony\Component\DependencyInjection\Attribute\AsDecorator;
use Symfony\Component\DependencyInjection\Attribute\AutowireDecorated;

/** The closed word lists the plain controllers answer in, as OpenAPI schemas, so @soirely/api-client generates them rather than copying them. */
#[AsDecorator('api_platform.openapi.factory')]
final readonly class ClosedVocabularies implements OpenApiFactoryInterface
{
    public function __construct(
        #[AutowireDecorated]
        private OpenApiFactoryInterface $decorated,
    ) {
    }

    /** @param array<string, mixed> $context */
    public function __invoke(array $context = []): OpenApi
    {
        $openApi = ($this->decorated)($context);
        $components = $openApi->getComponents();
        $schemas = $components->getSchemas() ?? new ArrayObject();
        $schemas['TableShape'] = new ArrayObject([
            'type' => 'string',
            'enum' => Vec\map(TableShape::cases(), static fn (TableShape $shape): string => $shape->value),
        ]);

        return $openApi->withComponents($components->withSchemas($schemas));
    }
}
