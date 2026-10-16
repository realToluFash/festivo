<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\UserRegistrar;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\FrameworkRoutes;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\PolicedRouteLoader;
use App\Http\Access\PolicyReader;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\Access\FixtureDirectories;
use App\Tests\Fixtures\Access\FixtureTable;
use App\Tests\Fixtures\Access\FixtureTableRepository;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Uid\Uuid;

final class AccessLayerTest extends ApiTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private Uuid $organisation;
    private Uuid $otherOrganisation;
    private Uuid $event;
    private Uuid $otherEvent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organisation = Uuid::v7();
        $this->otherOrganisation = Uuid::v7();
        $this->event = Uuid::v7();
        $this->otherEvent = Uuid::v7();

        $user = self::service(UserRegistrar::class)->register('member@example.com', 'Member', self::PASSWORD)->user;
        self::service(EntityManagerInterface::class)->flush();

        $this->client->setServerParameter(
            'HTTP_AUTHORIZATION',
            'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user),
        );

        FixtureTableRepository::$tables = [];
    }

    #[Test]
    public function everyRegisteredRouteDeclaresAPolicy(): void
    {
        $routes = self::service(RouterInterface::class)->getRouteCollection();

        self::assertGreaterThan(10, $routes->count());

        foreach ($routes->all() as $name => $route) {
            if (FrameworkRoutes::isPublic($name)) {
                continue;
            }

            self::assertNotNull(
                PolicyReader::forRoute($route->getDefault('_controller'), $route->getDefault('_api_resource_class')),
                Str\format('Route "%s" declares no access policy.', $name),
            );
        }
    }

    #[Test]
    public function aRouteWithoutAPolicyStopsTheRoutesLoadingAndIsNamed(): void
    {
        $routes = new RouteCollection();
        $routes->add('forgot_its_policy', new Route('/api/forgotten', ['_controller' => self::class . '::setUp']));

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Route "forgot_its_policy" (/api/forgotten) declares no access policy.');

        PolicedRouteLoader::refuseUnpoliced($routes);
    }

    #[Test]
    public function anOrganisationRouteNeedsAnAccount(): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->directories([$this->organisation->toRfc4122() => Grants::everything()]);

        $body = $this->get('/api/_access/organisations/' . $this->organisation->toRfc4122());

        self::assertResponseStatusCodeSame(401);
        self::assertSame(ErrorCode::Unauthenticated->type(), $body['type']);
    }

    /** A 403 would confirm the organisation exists to somebody who is not in it. */
    #[Test]
    public function aNonMemberIsToldNotFoundNotForbidden(): void
    {
        $this->directories([$this->otherOrganisation->toRfc4122() => Grants::everything()]);

        $body = $this->get('/api/_access/organisations/' . $this->organisation->toRfc4122());

        self::assertResponseStatusCodeSame(404);
        self::assertSame(ErrorCode::NotFound->type(), $body['type']);
    }

    #[Test]
    public function aMemberWithoutThePermissionIsRefusedWithThePermissionNamed(): void
    {
        $this->directories([$this->organisation->toRfc4122() => Grants::only([])]);

        $body = $this->get('/api/_access/organisations/' . $this->organisation->toRfc4122());

        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PermissionRequired->type(), $body['type']);
        self::assertSame(Permission::OrganisationManage->value, $body['permission']);

        $raw = (string) $this->client->getResponse()->getContent();
        self::assertStringNotContainsString('InOrganisation', $raw, 'no internal policy name');
        self::assertStringNotContainsString('AccessListener', $raw, 'no stack trace');
    }

    #[Test]
    public function aMemberHoldingThePermissionIsLetThrough(): void
    {
        $this->directories([$this->organisation->toRfc4122() => Grants::only([Permission::OrganisationManage])]);

        $body = $this->get('/api/_access/organisations/' . $this->organisation->toRfc4122());

        self::assertResponseStatusCodeSame(200);
        self::assertTrue($body['reached']);
    }

    /** Every permission in another organisation is not a way into this one's events: membership comes first. */
    #[Test]
    public function permissionsHeldElsewhereDoNotOpenAnEvent(): void
    {
        $table = $this->table($this->event);
        $this->directories(
            [$this->otherOrganisation->toRfc4122() => Grants::everything()],
            [$this->event->toRfc4122() => $this->organisation],
        );

        $this->get(Str\format('/api/_access/events/%s/tables/%s', $this->event->toRfc4122(), $table->toRfc4122()));

        self::assertResponseStatusCodeSame(404);
    }

    #[Test]
    public function aSubResourceIsLoadedThroughItsEvent(): void
    {
        $table = $this->table($this->event);
        $this->directories(
            [$this->organisation->toRfc4122() => Grants::everything()],
            [$this->event->toRfc4122() => $this->organisation],
        );

        $body = $this->get(Str\format('/api/_access/events/%s/tables/%s', $this->event->toRfc4122(), $table->toRfc4122()));

        self::assertResponseStatusCodeSame(200);
        self::assertSame($table->toRfc4122(), $body['table']);
    }

    /** The same 404 as an id that does not exist, so the answer cannot be used to find another event's rows. */
    #[Test]
    public function anotherEventsSubResourceIsNotFoundLikeOneThatDoesNotExist(): void
    {
        $theirs = $this->table($this->otherEvent);
        $this->directories(
            [$this->organisation->toRfc4122() => Grants::everything()],
            [$this->event->toRfc4122() => $this->organisation, $this->otherEvent->toRfc4122() => $this->organisation],
        );

        $borrowed = $this->get(Str\format('/api/_access/events/%s/tables/%s', $this->event->toRfc4122(), $theirs->toRfc4122()));
        self::assertResponseStatusCodeSame(404);

        $invented = $this->get(Str\format('/api/_access/events/%s/tables/%s', $this->event->toRfc4122(), Uuid::v7()->toRfc4122()));
        self::assertResponseStatusCodeSame(404);

        unset($borrowed['correlationId'], $invented['correlationId']);
        self::assertSame($invented, $borrowed);
    }

    #[Test]
    public function anEventThatDoesNotExistIsNotFound(): void
    {
        $this->directories([$this->organisation->toRfc4122() => Grants::everything()]);

        $this->get(Str\format('/api/_access/events/%s/tables/%s', Uuid::v7()->toRfc4122(), Uuid::v7()->toRfc4122()));

        self::assertResponseStatusCodeSame(404);
    }

    /**
     * @param array<string, Grants> $grants
     * @param array<string, Uuid>   $events
     */
    private function directories(array $grants, array $events = []): void
    {
        $directories = new FixtureDirectories($grants, $events);

        self::getContainer()->set(MembershipDirectoryInterface::class, $directories);
        self::getContainer()->set(EventDirectoryInterface::class, $directories);
    }

    private function table(Uuid $event): Uuid
    {
        $table = new FixtureTable(Uuid::v7(), $event);
        FixtureTableRepository::$tables[] = $table;

        return $table->id;
    }

    /** @return array<string, mixed> */
    private function get(string $path): array
    {
        $this->client->request('GET', $path);

        return Json\typed(
            (string) $this->client->getResponse()->getContent(),
            Type\dict(Type\string(), Type\mixed()),
        );
    }
}
