<?php

declare(strict_types=1);

namespace App\Http\Access;

use LogicException;
use Psl\Str;
use Symfony\Component\Config\Loader\LoaderInterface;
use Symfony\Component\Config\Loader\LoaderResolverInterface;
use Symfony\Component\DependencyInjection\Attribute\AsDecorator;
use Symfony\Component\DependencyInjection\Attribute\AutowireDecorated;
use Symfony\Component\Routing\RouteCollection;

/** The router's collection is refused, naming the route, if any route in it declares no policy. */
#[AsDecorator('routing.loader')]
final readonly class PolicedRouteLoader implements LoaderInterface
{
    public function __construct(
        #[AutowireDecorated]
        private LoaderInterface $inner,
    ) {
    }

    public function load(mixed $resource, ?string $type = null): mixed
    {
        $loaded = $this->inner->load($resource, $type);

        if ($loaded instanceof RouteCollection) {
            self::refuseUnpoliced($loaded);
        }

        return $loaded;
    }

    public static function refuseUnpoliced(RouteCollection $routes): void
    {
        foreach ($routes->all() as $name => $route) {
            if (FrameworkRoutes::isPublic($name)) {
                continue;
            }

            if (null === PolicyReader::forRoute($route->getDefault('_controller'), $route->getDefault('_api_resource_class'))) {
                throw new LogicException(Str\format(
                    'Route "%s" (%s) declares no access policy. Add #[PublicAccess], #[Authenticated], '
                    . '#[InOrganisation] or #[InEvent] to its controller or resource.',
                    $name,
                    $route->getPath(),
                ));
            }
        }
    }

    public function supports(mixed $resource, ?string $type = null): bool
    {
        return $this->inner->supports($resource, $type);
    }

    public function getResolver(): LoaderResolverInterface
    {
        return $this->inner->getResolver();
    }

    public function setResolver(LoaderResolverInterface $resolver): void
    {
        $this->inner->setResolver($resolver);
    }
}
