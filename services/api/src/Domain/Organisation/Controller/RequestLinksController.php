<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Http\JoinRequestSerialiser;
use App\Domain\Organisation\RequestLink\LinkRequester;
use App\Domain\Organisation\RequestLink\RequestStanding;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Str;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The person opening an organisation's request link (sc-562). The token is a credential, so it travels in the body, never the URL. */
final readonly class RequestLinksController
{
    public function __construct(
        private Security $security,
        private LinkRequester $linkRequester,
        private JoinRequestSerialiser $joinRequestSerialiser,
        private TranslatorInterface $translator,
    ) {
    }

    /** The organisation's name and, for somebody signed in, whether they can ask. */
    #[Route('/api/request-links/link', name: 'request_links_link', methods: ['POST'])]
    #[PublicAccess]
    public function link(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['token' => Type\string()]));
        $organisation = $this->linkRequester->organisationFor($body['token']);
        $user = $this->security->getUser();
        $standing = $user instanceof User ? $this->linkRequester->standingOf($user, $organisation) : null;

        return new JsonResponse([
            'organisation' => ['name' => $organisation->getName()],
            'standing' => $standing?->value,
            'askAgainFrom' => RequestStanding::CoolingOff === $standing && $user instanceof User
                ? $this->linkRequester->coolingOffUntil($user, $organisation)?->format(\DATE_ATOM)
                : null,
        ]);
    }

    /** On the onboarding gate's exempt list, so an account registered from the link can ask before it has an organisation. */
    #[Route('/api/request-links/ask', name: 'request_links_ask', methods: ['POST'])]
    #[Authenticated]
    public function ask(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'token' => Type\string(),
            'message' => Type\optional(Type\nullable(Type\string())),
        ]));
        $user = $this->user();

        // The gate is skipped, not its first step: an address nobody proved cannot ask in its own name.
        if (!$user->isVerified()) {
            throw new ApiException(ErrorCode::AccountUnverified, $this->translator->trans('gate.email_unverified'));
        }

        $message = $body['message'] ?? null;

        if (null !== $message && Str\length(Str\trim($message)) > LinkRequester::MESSAGE_MOST) {
            throw ApiException::validation([[
                'propertyPath' => 'message',
                'message' => $this->translator->trans('request_link.message_long', ['{count}' => (string) LinkRequester::MESSAGE_MOST]),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $membership = $this->linkRequester->ask($user, $this->linkRequester->organisationFor($body['token']), $message);

        return new JsonResponse(['request' => $this->joinRequestSerialiser->request($membership)], Response::HTTP_CREATED);
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
