<?php

declare(strict_types=1);

namespace App\Enum;

/** The step a passkey challenge was made for. A challenge is refused at any other. */
enum PasskeyStep: string
{
    case SignIn = 'sign_in';
    case Proof = 'proof';
    case Reset = 'reset';
    case TurnOn = 'turn_on';
    case Add = 'add';
    case AddApp = 'add_app';
    case Register = 'register';
    case Remove = 'remove';
    case NewCodes = 'new_codes';
    case TurnOff = 'turn_off';
}
