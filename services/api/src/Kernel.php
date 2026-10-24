<?php

declare(strict_types=1);

namespace App;

use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;
use Symfony\Component\Routing\Matcher\CompiledUrlMatcher;

class Kernel extends BaseKernel implements CompilerPassInterface
{
    use MicroKernelTrait;

    /** An API resource has one URL: a path with a trailing slash is a 404, not a redirect to the slash-less route. */
    public function process(ContainerBuilder $container): void
    {
        $router = $container->getDefinition('router.default');
        $router->replaceArgument(2, ['matcher_class' => CompiledUrlMatcher::class] + $router->getArgument(2));
    }
}
