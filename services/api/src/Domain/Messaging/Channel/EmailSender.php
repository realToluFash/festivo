<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Channel;

use App\Domain\Messaging\Exception\Unreachable;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Psl\Str;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;

/** SMTP takes no idempotency key, so the delivery id is the Message-ID: a second send of one delivery is the same message to the receiving end. */
final readonly class EmailSender implements ChannelSenderInterface
{
    public function __construct(
        private MailerInterface $mailer,
        private string $mailFrom,
    ) {
    }

    public function channel(): NotificationChannel
    {
        return NotificationChannel::Email;
    }

    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification, ?string $collapseKey = null): ?string
    {
        $address = $recipient->emailAddress ?? throw new Unreachable('No email address.');
        $messageId = $deliveryId->toRfc4122() . '@notifications.soirely';
        $email = new Email()
            ->from(null === $notification->senderName ? Address::create($this->mailFrom) : new Address(Address::create($this->mailFrom)->getAddress(), $notification->senderName))
            ->to($address)
            ->subject($notification->subject)
            ->text($notification->body);
        $email->getHeaders()->addIdHeader('Message-ID', $messageId);
        // Postmark returns X-PM-Metadata-* in its webhooks, which is how a report finds its delivery (MailWebhook).
        $email->getHeaders()->addTextHeader('X-PM-Metadata-delivery', $deliveryId->toRfc4122());

        if (null !== $notification->unsubscribe) {
            $mailto = 'mailto:unsubscribe@' . (Str\after_last(Address::create($this->mailFrom)->getAddress(), '@') ?? '') . '?subject=' . \rawurlencode($notification->unsubscribe);
            $email->getHeaders()->addTextHeader('List-Unsubscribe', '<' . $notification->unsubscribe . '>, <' . $mailto . '>');
            $email->getHeaders()->addTextHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
        }

        try {
            $this->mailer->send($email);
        } catch (TransportExceptionInterface $refused) {
            // Postmark's error 406, an inactive recipient: "… marked as inactive. Found inactive addresses: …". The worker takes it as Not sent only for a guest's message.
            if (Str\contains_ci($refused->getMessage(), 'marked as inactive')) {
                throw Unreachable::providerBlocked($refused);
            }

            throw $refused;
        }

        return $messageId;
    }
}
