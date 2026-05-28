import { useContext } from 'react';
import { PushNotificationContext } from './PushNotificationContextObject';

export const usePushNotifications = () => useContext(PushNotificationContext);
