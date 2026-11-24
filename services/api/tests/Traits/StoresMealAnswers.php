<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Enum\GuestReply;
use App\Enum\GuestReplySource;
use App\Enum\MealAnswerKind;
use DateTimeImmutable;
use PHPUnit\Framework\Assert;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/**
 * A stored answer to a course (sc-3907), as the guest's RSVP would have sent it, from a person who is coming.
 *
 * @phpstan-require-extends \App\Tests\ApiTestCase
 */
trait StoresMealAnswers
{
    /** The id may be a dish's, a variant's or an option's; a person answers a course once, so a second pick on the same course adds the option to it. */
    private function picks(string $id, Guest $person): void
    {
        $em = self::em();
        $variant = $em->find(MenuDishVariant::class, Uuid::fromString($id));
        $option = $em->find(MenuChoiceOption::class, Uuid::fromString($id));
        $dish = $variant?->getDish() ?? $option?->getChoice()->getDish() ?? $em->find(MenuDish::class, Uuid::fromString($id)) ?? Assert::fail('nothing picked has id ' . $id);
        $person = $em->find(Guest::class, $person->getId()) ?? Assert::fail('the person is not stored');
        $this->comes($person);
        $answer = $this->answerOf($person, $dish);

        if (null === $answer) {
            $em->persist(new MealAnswer($person, $dish->getCourse(), MealAnswerKind::Chosen, $dish, $variant, null === $option ? [] : [$id], []));
        } elseif (null !== $option && !Iter\contains($answer->getOptions(), $id)) {
            $answer->answer(MealAnswerKind::Chosen, $dish, $answer->getVariant(), [...$answer->getOptions(), $id], []);
        }

        $em->flush();
    }

    /** Someone who picked the dish and left its optional choice at None for me. */
    private function answersNone(MenuDishChoice $choice, Guest $person): void
    {
        $this->picks($choice->getDish()->getId()->toRfc4122(), $person);
    }

    private function comes(Guest $person): void
    {
        $replier = $person->getHost() ?? $person;

        if (GuestReply::Coming !== $replier->getReply()) {
            $replier->reply(GuestReply::Coming, new DateTimeImmutable(), GuestReplySource::Host);
        }
    }

    private function answerOf(Guest $person, MenuDish $dish): ?MealAnswer
    {
        $answers = self::em()->getRepository(MealAnswer::class)->findBy(['person' => $person, 'course' => $dish->getCourse()]);

        return Vec\values($answers)[0] ?? null;
    }
}
