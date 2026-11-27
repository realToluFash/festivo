<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Controller;

use App\Domain\Messaging\GuestMessages\GuestEmailUnsubscribe;
use App\Domain\Messaging\GuestMessages\GuestSuppressions;
use App\Entity\Guest;
use App\Enum\GuestChannel;
use App\Enum\GuestSuppressionReason;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\GuestRepository;
use Psl\Dict;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * A guest's Your messages (sc-3969). The mail app's one-click POST (RFC 8058) stops the organisation's emails to the guest's address. A GET changes nothing, as mail scanners and link previews open links first: it sends the browser to the page, the token after its `#`. The page asks and sets through the last two routes, with the email's token or the guest page's own in the body. No answer names the guest or carries an address: a link in an email gets forwarded.
 */
#[PublicAccess]
final readonly class YourMessagesController
{
    public function __construct(
        private GuestEmailUnsubscribe $guestEmailUnsubscribe,
        private GuestSuppressions $guestSuppressions,
        private GuestRepository $guestRepository,
        private TranslatorInterface $translator,
        #[Autowire(env: 'CORS_WEB_ORIGIN')]
        private string $webOrigin,
    ) {
    }

    #[Route('/api/unsubscribe/guest/{token}', name: 'guest_unsubscribe', requirements: ['token' => GuestEmailUnsubscribe::PATTERN], methods: ['GET'])]
    public function open(#[SensitiveParameter] string $token): Response
    {
        return self::private(new RedirectResponse(Str\trim_right($this->webOrigin, '/') . GuestEmailUnsubscribe::PAGE . \rawurlencode($token), Response::HTTP_SEE_OTHER));
    }

    #[Route('/api/unsubscribe/guest/{token}', name: 'guest_unsubscribe_post', requirements: ['token' => GuestEmailUnsubscribe::PATTERN], methods: ['POST'])]
    public function oneClick(#[SensitiveParameter] string $token): Response
    {
        $guest = $this->fromEmail($token);

        if (null === $guest) {
            return self::private(new Response(null, Response::HTTP_NOT_FOUND));
        }

        $this->turn($guest, GuestChannel::Email, false);

        return self::private(new Response(null, Response::HTTP_OK));
    }

    #[Route('/api/your-messages', name: 'your_messages', methods: ['POST'])]
    public function status(Request $request): JsonResponse
    {
        return $this->answer($this->guest(Input::body($request, self::who())));
    }

    /** Refused 422 for a channel the guest has no address on, which records nothing. */
    #[Route('/api/your-messages', name: 'your_messages_set', methods: ['PUT'])]
    public function set(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'token' => Type\optional(Type\string()),
            'guestToken' => Type\optional(Type\string()),
            'channel' => Type\string(),
            'on' => Type\bool(),
        ]));
        $guest = $this->guest($body);
        $channel = GuestChannel::fromField($body['channel']);

        if (null === $channel || null === self::address($guest, $channel)) {
            throw ApiException::validation([[
                'propertyPath' => 'channel',
                'message' => $this->translator->trans('validation.your_messages_no_address'),
                'code' => 'no_address',
            ]]);
        }

        $this->turn($guest, $channel, $body['on']);

        return $this->answer($guest);
    }

    private function turn(Guest $guest, GuestChannel $channel, bool $on): void
    {
        $address = self::address($guest, $channel);

        if (null === $address) {
            return;
        }

        $organisation = $guest->getEvent()->getOrganisation()->getId();
        $on
            ? $this->guestSuppressions->lift($organisation, $channel, $address)
            : $this->guestSuppressions->suppress($organisation, $channel, $address, GuestSuppressionReason::of($channel));
    }

    private function answer(Guest $guest): JsonResponse
    {
        $organisation = $guest->getEvent()->getOrganisation();
        $channels = Dict\from_entries(Vec\map(GuestChannel::cases(), function (GuestChannel $channel) use ($guest, $organisation): array {
            $address = self::address($guest, $channel);

            return [$channel->field(), [
                'onRecord' => null !== $address,
                'on' => null !== $address && null === $this->guestSuppressions->since($organisation->getId(), $channel, $address),
            ]];
        }));

        return self::private(new JsonResponse(['organisation' => $organisation->getName(), 'channels' => $channels]));
    }

    private static function address(Guest $guest, GuestChannel $channel): ?string
    {
        $address = GuestChannel::Email === $channel ? $guest->getEmail() : $guest->getMobile();

        return null === $address || '' === Str\trim($address) ? null : $address;
    }

    /** @param array{token?: string, guestToken?: string, ...} $body */
    private function guest(array $body): Guest
    {
        $guest = match (true) {
            isset($body['token']) => $this->fromEmail($body['token']),
            isset($body['guestToken']) && '' !== $body['guestToken'] => $this->guestRepository->findOneByLink($body['guestToken']),
            default => null,
        };

        return $guest ?? throw ApiException::notFound('access.not_found');
    }

    private function fromEmail(#[SensitiveParameter] string $token): ?Guest
    {
        $id = $this->guestEmailUnsubscribe->guestOf($token);
        $guest = null === $id ? null : $this->guestRepository->findOneBy(['id' => $id, 'removedAt' => null]);

        return null !== $guest && $this->guestEmailUnsubscribe->signs($token, $guest) ? $guest : null;
    }

    /** @return Type\TypeInterface<array{token?: string, guestToken?: string}> */
    private static function who(): Type\TypeInterface
    {
        return Type\shape(['token' => Type\optional(Type\string()), 'guestToken' => Type\optional(Type\string())]);
    }

    /**
     * @template T of Response
     *
     * @param T $response
     *
     * @return T
     */
    private static function private(Response $response): Response
    {
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        $response->headers->set('Cache-Control', 'no-store');

        return $response;
    }
}
