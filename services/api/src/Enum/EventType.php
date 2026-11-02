<?php

declare(strict_types=1);

namespace App\Enum;

/** What kind of event it is, in the order the forms offer them (sc-3588). packages/domain's EVENT_TYPES is the same list. */
enum EventType: string
{
    case Wedding = 'wedding';
    case Birthday = 'birthday';
    case Anniversary = 'anniversary';
    case Engagement = 'engagement';
    case BabyShower = 'baby_shower';
    case Graduation = 'graduation';
    case Memorial = 'memorial';
    case Religious = 'religious';
    case Cultural = 'cultural';
    case Party = 'party';
    case Gala = 'gala';
    case Conference = 'conference';
    case Corporate = 'corporate';
    case Other = 'other';
}
