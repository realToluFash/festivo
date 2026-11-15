import { DevSettings } from 'react-native';

export const devReload = (reason: string): void => DevSettings.reload(reason);
