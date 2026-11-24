<?php

declare(strict_types=1);

// Two organisations paid for by one billing account with credits for one SMS, committed so other processes see them, for UsageRaceTest, which deletes them again; prints their ids as JSON.

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Kernel;
use Doctrine\ORM\EntityManagerInterface;
use Psl\IO;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Type;
use Symfony\Component\Dotenv\Dotenv;

require \dirname(__DIR__, 3) . '/vendor/autoload.php';

$_SERVER['APP_ENV'] = 'test';
$_ENV['APP_ENV'] = 'test';
new Dotenv()->bootEnv(\dirname(__DIR__, 3) . '/.env');

$kernel = new Kernel('test', true);
$kernel->boot();
$container = Type\instance_of(Symfony\Component\DependencyInjection\ContainerInterface::class)->coerce($kernel->getContainer()->get('test.service_container'));
$entityManager = Type\instance_of(EntityManagerInterface::class)->coerce($container->get(EntityManagerInterface::class));
$registrar = Type\instance_of(UserRegistrar::class)->coerce($container->get(UserRegistrar::class));
$founder = Type\instance_of(OrganisationFounder::class)->coerce($container->get(OrganisationFounder::class));

$address = 'race-' . SecureRandom\string(8) . '@ire.events';
$user = $registrar->register($address, 'Person', 'a decent passphrase')->user;
$first = $founder->found($user, 'Race Events', 'NG', 'Africa/Lagos');
$second = $founder->found($user, 'Race Weddings', 'NG', 'Africa/Lagos');
$entityManager->flush();

$connection = $entityManager->getConnection();
$account = Type\string()->coerce($connection->fetchOne('SELECT billing_account_id FROM subscriptions WHERE organisation_id = ?', [$first->getId()->toRfc4122()]));
$abandoned = Type\string()->coerce($connection->fetchOne('SELECT billing_account_id FROM subscriptions WHERE organisation_id = ?', [$second->getId()->toRfc4122()]));
$connection->executeStatement('UPDATE subscriptions SET billing_account_id = ? WHERE organisation_id = ?', [$account, $second->getId()->toRfc4122()]);
$connection->executeStatement('UPDATE billing_accounts SET credit_balance = 62 WHERE id = ?', [$account]);

IO\write(Json\encode([
    'userId' => $user->getId()->toRfc4122(),
    'address' => $address,
    'organisations' => [$first->getId()->toRfc4122(), $second->getId()->toRfc4122()],
    'accounts' => [$account, $abandoned],
]));
