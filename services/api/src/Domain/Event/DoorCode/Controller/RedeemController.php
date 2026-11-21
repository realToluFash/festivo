<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode\Controller;

use App\Domain\Event\DoorCode\DoorCodeRedeemer;
use App\Domain\User\Http\IssuedTokensResponse;
use App\Entity\DoorCode;
use App\Entity\User;
use App\Enum\RefreshTokenDelivery;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Opening and redeeming a door code (sc-72): signed in or not, and never a membership. */
#[PublicAccess]
final readonly class RedeemController
{
    public function __construct(
        private Security $security,
        private DoorCodeRedeemer $doorCodeRedeemer,
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

    /** Signed out, `name` is required and the answer carries the new session's tokens, as a sign-in's does. */
    #[Route('/api/door-codes/{code}/redeem', name: 'door_codes_redeem', methods: ['POST'])]
    public function redeem(Request $request, string $code): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\nullable(Type\string())),
            'refreshTokenIn' => Type\optional(Type\backed_enum(RefreshTokenDelivery::class)),
        ]));
        $redeemed = $this->doorCodeRedeemer->redeem($code, $body['name'] ?? null, $this->reader(), $request);
        $person = $redeemed['person'];
        $answer = [
            'eventId' => $person->getEvent()->getId()->toRfc4122(),
            'name' => $redeemed['user']->getName(),
            'role' => $person->getRole()->value,
            'jobLabel' => $person->getJobLabel(),
            'endsAt' => $person->getEvent()->getClosesAt()?->format(\DATE_ATOM),
            'again' => $redeemed['again'],
        ];

        if (null !== $redeemed['tokens']) {
            return new IssuedTokensResponse($redeemed['tokens'], $body['refreshTokenIn'] ?? RefreshTokenDelivery::Body, $request, $answer, Response::HTTP_CREATED);
        }

        return new JsonResponse($answer, $answer['again'] ? Response::HTTP_OK : Response::HTTP_CREATED);
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
