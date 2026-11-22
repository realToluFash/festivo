<?php

declare(strict_types=1);

namespace App\Tests\Double;

use AsyncAws\Core\Configuration;
use AsyncAws\S3\Result\PutObjectOutput;
use AsyncAws\S3\S3Client;
use Closure;

/** Lets another try finish while this one is still writing its archive. */
final class S3ClientWithAnotherTryFirst extends S3Client
{
    private ?Closure $first;

    public function __construct(Configuration $configuration, Closure $first)
    {
        parent::__construct($configuration);
        $this->first = $first;
    }

    public function putObject($input): PutObjectOutput
    {
        $first = $this->first;
        $this->first = null;

        if (null !== $first) {
            $first();
        }

        return parent::putObject($input);
    }
}
