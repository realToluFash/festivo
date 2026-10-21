<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Handover\WorkHandover;
use App\Domain\Organisation\Members\MemberActions;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedResponsibilityLedger;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Email;

final class WorkHandoverTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('folake@ire.events', 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function removingAMemberWithWorkNeedsSomebodyToTakeIt(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->ledger()->give($this->organisation, $bisi, 'Adaeze at 30');
        $this->ledger()->give($this->organisation, $bisi, 'The Okafor wedding');

        $work = $this->as($this->owner, 'GET', $this->path('/members/' . $this->membershipOf($bisi) . '/work'));
        self::assertSame(['Adaeze at 30', 'The Okafor wedding'], Vec\map(Type\vec(Type\shape(['title' => Type\string()], true))->coerce($work['items'] ?? null), static fn (array $item): string => $item['title']));

        $refused = $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($bisi)));
        self::assertSame(422, $this->statusCode(), Json\encode($refused));
        self::assertSame(ErrorCode::ValidationFailed->type(), $refused['type'] ?? null);
        self::assertSame(MembershipStatus::Active, $this->membership($bisi)->getStatus(), 'the removal waits for the choice');
        self::assertCount(2, $this->ledger()->titlesHeldBy($this->organisation, $bisi));

        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($bisi)), ['handTo' => $this->membershipOf($this->owner)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($bisi)->getStatus());
        self::assertSame([], $this->ledger()->titlesHeldBy($this->organisation, $bisi));
        self::assertSame(['Adaeze at 30', 'The Okafor wedding'], $this->ledger()->titlesHeldBy($this->organisation, $this->owner));
        self::assertSame(2, $this->audited(WorkHandover::RECEIVED), 'each item records the handover in its history');
        self::assertSame(1, $this->audited(WorkHandover::HANDED_OVER));
        self::assertSame(1, $this->audited(MemberActions::REMOVED));

        $summary = $this->handoverMails();
        self::assertSame(['folake@ire.events'], $this->recipients($summary));
        $text = (string) $summary[0]->getTextBody();
        self::assertStringContainsString('Bisi Adeyemi is no longer a member of Ìrè Events. You are now responsible for the 2 things', $text);
        self::assertStringContainsString('- Adaeze at 30', $text);
        self::assertStringContainsString('- The Okafor wedding', $text);
    }

    #[Test]
    public function theHandoverIsAuditedWithFromWhomToWhomAndTheList(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $held = $this->ledger()->give($this->organisation, $bisi, 'Adaeze at 30');

        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($bisi)), ['handTo' => $this->membershipOf($chidi)]);
        self::assertSame(204, $this->statusCode());

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => WorkHandover::HANDED_OVER]) ?? self::fail('not audited');
        self::assertSame($this->membership($bisi)->getId()->toRfc4122(), $entry->subjectId()->toRfc4122());
        self::assertSame([
            'responsible' => [$bisi->getId()->toRfc4122(), $chidi->getId()->toRfc4122()],
            'items' => [null, [['kind' => 'eventLead', 'subjectType' => 'Event', 'subjectId' => $held->id->toRfc4122(), 'title' => 'Adaeze at 30']]],
        ], $entry->changes());
        self::assertSame(['chidi@ire.events'], $this->recipients($this->handoverMails()));
    }

    #[Test]
    public function removingAMemberWithNoWorkAsksNothing(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);

        self::assertSame(['items' => []], $this->as($this->owner, 'GET', $this->path('/members/' . $this->membershipOf($bisi) . '/work')));
        $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($bisi)));
        self::assertSame(204, $this->statusCode());
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($bisi)->getStatus());
        self::assertSame(0, $this->audited(WorkHandover::HANDED_OVER));
        self::assertSame([], $this->handoverMails());
    }

    #[Test]
    public function theWorkGoesOnlyToAnotherActiveMember(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->ledger()->give($this->organisation, $bisi, 'Adaeze at 30');
        $other = $this->account('ngozi@elsewhere.events', 'Ngozi Eze', withOwn: true);
        $elsewhere = self::em()->getRepository(Membership::class)->findOneBy(['user' => $other->getId()]) ?? self::fail('no membership');

        foreach ([$this->membershipOf($bisi), $elsewhere->getId()->toRfc4122(), 'not-an-id'] as $handTo) {
            $refused = $this->as($this->owner, 'DELETE', $this->path('/members/' . $this->membershipOf($bisi)), ['handTo' => $handTo]);
            self::assertSame(422, $this->statusCode(), $handTo);
            self::assertSame('handTo', Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($refused['violations'] ?? null)[0]['propertyPath'] ?? null, Json\encode($refused));
        }

        self::assertSame(['Adaeze at 30'], $this->ledger()->titlesHeldBy($this->organisation, $bisi));
    }

    #[Test]
    public function leavingAndChoosingNobodyGivesTheWorkToTheOwnersAndEmailsThem(): void
    {
        $second = $this->member('tunde@ire.events', 'Tunde Bakare', SeededRole::Owner);
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $this->ledger()->give($this->organisation, $chidi, 'Adaeze at 30');

        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->as($chidi, 'GET', $this->path('/work'))['items'] ?? null));
        $this->as($chidi, 'POST', $this->path('/leave'), ['handTo' => null]);
        self::assertSame(204, $this->statusCode());

        self::assertSame(['Adaeze at 30'], $this->ledger()->titlesHeldBy($this->organisation, $this->owner), 'the longest-standing Owner');
        self::assertSame([], $this->ledger()->titlesHeldBy($this->organisation, $second));
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($chidi)->getStatus());
        self::assertSame(1, $this->audited(MemberActions::LEFT));

        $mails = $this->handoverMails();
        self::assertSame(['folake@ire.events', 'tunde@ire.events'], Vec\sort($this->recipients($mails)));
        $toSecond = Vec\filter($mails, static fn (Email $mail): bool => 'tunde@ire.events' === $mail->getTo()[0]->getAddress())[0] ?? self::fail('no mail');
        self::assertStringContainsString('Chidi Okoro left Ìrè Events without choosing who takes their work, so Folake Adeyemi is now responsible for the thing', (string) $toSecond->getTextBody());
    }

    #[Test]
    public function leavingCanHandTheWorkToSomebodyChosen(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->ledger()->give($this->organisation, $chidi, 'Adaeze at 30');

        $this->as($chidi, 'POST', $this->path('/leave'), ['handTo' => $this->membershipOf($bisi)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame(['Adaeze at 30'], $this->ledger()->titlesHeldBy($this->organisation, $bisi));
        self::assertSame(['bisi@ire.events'], $this->recipients($this->handoverMails()), 'the Owners are emailed only when nobody was chosen');
    }

    #[Test]
    public function leavingWithNoWorkStillLeaves(): void
    {
        $chidi = $this->member('chidi@ire.events', 'Chidi Okoro', SeededRole::Coordinator);

        $this->as($chidi, 'POST', $this->path('/leave'));
        self::assertSame(204, $this->statusCode());
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membership($chidi)->getStatus());
        self::assertSame([], $this->handoverMails());
    }

    #[Test]
    public function suspensionMovesNothingUntilHandOverNow(): void
    {
        $bisi = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Coordinator);
        $this->ledger()->give($this->organisation, $bisi, 'Adaeze at 30');
        self::service(MembershipMachine::class)->move($this->membership($bisi), MembershipStatus::Suspended, MembershipChannel::Settings, null);
        self::em()->flush();

        self::assertSame(['Adaeze at 30'], $this->ledger()->titlesHeldBy($this->organisation, $bisi));
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', $this->path('/members/' . $this->membershipOf($bisi) . '/work'))['items'] ?? null));

        $this->as($this->owner, 'POST', $this->path('/members/' . $this->membershipOf($bisi) . '/handover'), ['handTo' => $this->membershipOf($this->owner)]);
        self::assertSame(204, $this->statusCode());
        self::assertSame(['Adaeze at 30'], $this->ledger()->titlesHeldBy($this->organisation, $this->owner));
        self::assertSame(MembershipStatus::Suspended, $this->membership($bisi)->getStatus(), 'handing over is not an answer to the suspension');
        self::assertSame(['folake@ire.events'], $this->recipients($this->handoverMails()));
    }

    #[Test]
    public function onlyWhoCouldRemoveThemHandsOverAnOwnersWork(): void
    {
        $second = $this->member('tunde@ire.events', 'Tunde Bakare', SeededRole::Owner);
        $admin = $this->member('bisi@ire.events', 'Bisi Adeyemi', SeededRole::Administrator);
        $this->ledger()->give($this->organisation, $second, 'Adaeze at 30');

        $this->as($admin, 'POST', $this->path('/members/' . $this->membershipOf($second) . '/handover'), ['handTo' => $this->membershipOf($admin)]);
        self::assertSame(403, $this->statusCode());
        self::assertSame(['Adaeze at 30'], $this->ledger()->titlesHeldBy($this->organisation, $second));
    }

    private function ledger(): ScriptedResponsibilityLedger
    {
        return self::service(ScriptedResponsibilityLedger::class);
    }

    /** @return list<Email> */
    private function handoverMails(): array
    {
        $mails = [];

        foreach (self::getMailerMessages() as $message) {
            if ($message instanceof Email && Str\ends_with((string) $message->getSubject(), 'has been handed over')) {
                $mails[] = $message;
            }
        }

        return $mails;
    }

    /**
     * @param list<Email> $mails
     *
     * @return list<string>
     */
    private function recipients(array $mails): array
    {
        return Vec\map($mails, static fn (Email $mail): string => $mail->getTo()[0]->getAddress());
    }

    private function audited(string $action): int
    {
        return self::em()->getRepository(AuditEntry::class)->count(['action' => $action]);
    }

    private function account(string $address, string $name, bool $withOwn = false): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: $withOwn);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation->getId(), 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function membership(User $user): Membership
    {
        self::em()->clear();

        return self::em()->getRepository(Membership::class)->findOneBy(['organisation' => $this->organisation->getId(), 'user' => $user->getId()]) ?? self::fail('no membership');
    }

    private function membershipOf(User $user): string
    {
        return $this->membership($user)->getId()->toRfc4122();
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . $rest;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
