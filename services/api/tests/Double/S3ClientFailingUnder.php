<?php

declare(strict_types=1);

namespace App\Tests\Double;

use AsyncAws\Core\Configuration;
use AsyncAws\S3\Result\ListObjectsV2Output;
use AsyncAws\S3\S3Client;
use Psl\Str;
use Psl\Type;
use RuntimeException;

/** A store unreachable for the keys under one prefix, and itself for the rest. */
final class S3ClientFailingUnder extends S3Client
{
    public function __construct(Configuration $configuration, private readonly string $prefix)
    {
        parent::__construct($configuration);
    }

    public function listObjectsV2($input): ListObjectsV2Output
    {
        if (Str\starts_with(Type\string()->coerce(Type\shape(['Prefix' => Type\string()], true)->coerce($input)['Prefix']), $this->prefix)) {
            throw new RuntimeException('The store did not answer.');
        }

        return parent::listObjectsV2($input);
    }
}
