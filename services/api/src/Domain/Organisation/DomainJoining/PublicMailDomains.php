<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use Psl\Iter;

/** Mail services anybody can sign up to, so an address there says nothing about an employer. */
final readonly class PublicMailDomains
{
    public const array DOMAINS = [
        'aim.com', 'aol.co.uk', 'aol.com', 'aol.fr', 'bol.com.br', 'bluewin.ch', 'btinternet.com',
        'cock.li', 'comcast.net', 'duck.com', 'fastmail.com', 'free.fr', 'gmail.com', 'gmx.at', 'gmx.com',
        'gmx.de', 'gmx.es', 'gmx.fr', 'gmx.net', 'gmx.pt', 'googlemail.com', 'hey.com', 'hotmail.co.uk',
        'hotmail.com', 'hotmail.com.br', 'hotmail.es', 'hotmail.fr', 'hotmail.it', 'hotmail.pt',
        'hushmail.com', 'icloud.com', 'ig.com.br', 'inbox.com', 'laposte.net', 'live.co.uk', 'live.com',
        'live.com.pt', 'live.fr', 'mac.com', 'mail.com', 'mail.ru', 'me.com', 'msn.com', 'neuf.fr',
        'orange.fr', 'outlook.com', 'outlook.com.br', 'outlook.es', 'outlook.fr', 'outlook.pt', 'pm.me',
        'proton.me', 'protonmail.ch', 'protonmail.com', 'qq.com', 'rediffmail.com', 'sapo.pt', 'sfr.fr',
        'sky.com', 'telefonica.net', 'terra.com.br', 'terra.es', 'tutanota.com', 'tuta.io', 'uol.com.br',
        'wanadoo.fr', 'web.de', 'yahoo.ca', 'yahoo.co.uk', 'yahoo.com', 'yahoo.com.ar', 'yahoo.com.br',
        'yahoo.com.mx', 'yahoo.es', 'yahoo.fr', 'yahoo.it', 'yandex.com', 'yandex.ru', 'ymail.com',
        'zoho.com', 'zohomail.com',
    ];

    public static function includes(string $normalisedDomain): bool
    {
        return Iter\contains(self::DOMAINS, $normalisedDomain);
    }
}
