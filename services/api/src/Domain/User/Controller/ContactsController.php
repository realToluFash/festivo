<?php

declare(strict_types=1);

namespace App\Domain\User\Controller;

use App\Domain\User\Contacts\LinkedContacts;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Entity\EmailAddress;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Settings > Account: alternative email addresses and phone numbers, on the signed-in account only (sc-113). */
#[Authenticated]
final readonly class ContactsController
{
    public function __construct(
        private Security $security,
        private LinkedContacts $linkedContacts,
        private PhoneNumberParser $phoneNumberParser,
    ) {
    }

    #[Route('/api/auth/emails', name: 'auth_emails_add', methods: ['POST'])]
    public function addEmail(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['address' => Type\string()]));

        return new JsonResponse(self::email($this->linkedContacts->addEmail($this->user(), $body['address'])), Response::HTTP_CREATED);
    }

    #[Route('/api/auth/emails/{id}/primary', name: 'auth_emails_primary', methods: ['PATCH'])]
    /** With the proof from `POST /api/auth/proof`: it changes how the account signs in. */
    public function makeEmailPrimary(Request $request, string $id): JsonResponse
    {
        $body = '' === $request->getContent() ? [] : Input::body($request, Type\shape(['proof' => Type\optional(Type\nullable(Type\string()))]));

        return new JsonResponse(self::email($this->linkedContacts->makeEmailPrimary($this->user(), self::id($id), $body['proof'] ?? null)));
    }

    #[Route('/api/auth/emails/{id}', name: 'auth_emails_remove', methods: ['DELETE'])]
    public function removeEmail(string $id): Response
    {
        $this->linkedContacts->removeEmail($this->user(), self::id($id));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/auth/phones', name: 'auth_phones_add', methods: ['POST'])]
    public function addPhone(Request $request): JsonResponse
    {
        $body = Input::body($request, Type\shape(['countryCode' => Type\string(), 'number' => Type\string()]));
        $phone = $this->phoneNumberParser->parse($body['number'], $body['countryCode']);

        return new JsonResponse(self::phone($this->linkedContacts->addPhone($this->user(), $phone)), Response::HTTP_CREATED);
    }

    #[Route('/api/auth/phones/{id}/primary', name: 'auth_phones_primary', methods: ['PATCH'])]
    public function makePhonePrimary(string $id): JsonResponse
    {
        return new JsonResponse(self::phone($this->linkedContacts->makePhonePrimary($this->user(), self::id($id))));
    }

    #[Route('/api/auth/phones/{id}', name: 'auth_phones_remove', methods: ['DELETE'])]
    public function removePhone(string $id): Response
    {
        $this->linkedContacts->removePhone($this->user(), self::id($id));

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** @return array<string, mixed> */
    private static function email(EmailAddress $address): array
    {
        return [
            'id' => $address->getId()->toRfc4122(),
            'address' => $address->getAddress(),
            'verified' => $address->isVerified(),
            'primary' => $address->isPrimary(),
        ];
    }

    /** @return array<string, mixed> */
    private static function phone(PhoneNumber $phone): array
    {
        return [
            'id' => $phone->getId()->toRfc4122(),
            'number' => $phone->getNumber(),
            'countryCode' => $phone->getCountryCode(),
            'verified' => $phone->isVerified(),
            'primary' => $phone->isPrimary(),
            'pending' => $phone->isPending(),
        ];
    }

    private static function id(string $id): Uuid
    {
        return Uuid::isValid($id) ? Uuid::fromString($id) : throw ApiException::notFound('contacts.not_linked');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
