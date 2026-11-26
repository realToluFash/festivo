<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode\Controller;

use App\Domain\Event\DoorCode\DoorCodeRedeemer;
use App\Domain\Event\DoorCode\DoorCodeSignIn;
use App\Domain\Staff\Attendance\JoinCodeShift;
use App\Domain\User\Http\SignInResponse;
use App\Entity\DoorCode;
use App\Entity\EventPerson;
use App\Entity\User;
use App\Entity\VerificationChallenge;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\CodeField;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Opening and redeeming a door code (sc-72): signed in, or signed out by a code to a mobile number (sc-4235), and never a membership. */
#[PublicAccess]
final readonly class RedeemController
{
    public function __construct(
        private Security $security,
        private DoorCodeRedeemer $doorCodeRedeemer,
        private DoorCodeSignIn $doorCodeSignIn,
        private SignInResponse $signInResponse,
        private CodeField $codeField,
        private JoinCodeShift $joinCodeShift,
    ) {
    }

    /** What the code opens, shown before a name is asked for; `standing` is `member`, `in` or null for a signed-in reader. */
    #[Route('/api/door-codes/{code}', name: 'door_codes_open', methods: ['GET'])]
    public function open(Request $request, string $code): JsonResponse
    {
        $reader = $this->reader();
        $doorCode = $this->doorCodeRedeemer->open($code, $reader, $request);

        return new JsonResponse([
            ...self::opened($doorCode),
            'standing' => $this->doorCodeRedeemer->standingOf($doorCode, $reader),
        ]);
    }

    /** Signed in only: the reader's own account takes the grant, or lands on You're in again. */
    #[Route('/api/door-codes/{code}/redeem', name: 'door_codes_redeem', methods: ['POST'])]
    public function redeem(Request $request, string $code): JsonResponse
    {
        $redeemed = $this->doorCodeRedeemer->redeem($code, $this->reader(), $request);
        $answer = $this->youreIn($redeemed['person'], $redeemed['again']);

        return new JsonResponse($answer, $redeemed['again'] ? Response::HTTP_OK : Response::HTTP_CREATED);
    }

    /** Signed out (sc-4235): a name and a mobile number, and a code to it; answers the same whether or not the number has an account. */
    #[Route('/api/door-codes/{code}/sign-in/send', name: 'door_codes_sign_in_send', methods: ['POST'])]
    public function send(Request $request, string $code): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\nullable(Type\string())),
            'number' => Type\optional(Type\nullable(Type\string())),
            'countryCode' => Type\optional(Type\nullable(Type\string())),
        ]));
        $handle = $this->doorCodeSignIn->send($code, $body['name'] ?? '', $body['number'] ?? '', $body['countryCode'] ?? '', $request);

        return new JsonResponse(['handle' => $handle, 'cooldownSeconds' => VerificationChallenge::RESEND_COOLDOWN_SECONDS]);
    }

    /** The code signs into the number's account, or makes one with the name typed; with two-factor on, a 202 challenge first, and the signed-in redeem after it. */
    #[Route('/api/door-codes/{code}/sign-in', name: 'door_codes_sign_in', methods: ['POST'])]
    public function signIn(Request $request, string $code): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'handle' => Type\string(),
            'code' => Type\optional(Type\mixed()),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
        $delivery = $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body;
        $signedIn = $this->doorCodeSignIn->signIn($code, $body['handle'], $this->codeField->required($body, 'code', CodeField::FROM_TEXT), $request, RefreshTokenDelivery::Cookie === $delivery);
        $person = $signedIn['person'];

        return $this->signInResponse->for($signedIn['admission'], $signedIn['user'], $delivery, $request, null === $person ? [] : $this->youreIn($person, $signedIn['again']));
    }

    /** @return array<string, mixed> `shift` says whether it lands on My night, or on You're in with why its shift was not joined (sc-234) */
    private function youreIn(EventPerson $person, bool $again): array
    {
        $doorCode = $person->getDoorCode();
        $user = $person->getUser();

        return [
            'eventId' => $person->getEvent()->getId()->toRfc4122(),
            'name' => $person->getUser()?->getName(),
            'role' => $person->getRole()->value,
            'jobLabel' => $person->getJobLabel(),
            'endsAt' => $person->getEvent()->getClosesAt()?->format(\DATE_ATOM),
            'again' => $again,
            'shift' => null === $doorCode || null === $user ? null : $this->joinCodeShift->answerFor($doorCode, $user),
        ];
    }

    /** @return array<string, mixed> */
    private static function opened(DoorCode $doorCode): array
    {
        $event = $doorCode->getEvent();

        return [
            'role' => $doorCode->getRole()->value,
            'jobLabel' => $doorCode->getJobLabel(),
            'event' => [
                'id' => $event->getId()->toRfc4122(),
                'name' => $event->getName(),
                'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
                'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
                'timeZone' => $event->getTimeZone(),
                'organisation' => $event->getOrganisation()->getName(),
            ],
        ];
    }

    private function reader(): ?User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : null;
    }
}
