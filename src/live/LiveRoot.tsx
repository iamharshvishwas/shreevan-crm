import { HMSRoomProvider } from '@100mslive/react-sdk';
import { LiveApp } from './LiveApp';

/** Default export so it can be lazy-loaded — keeps the heavy 100ms SDK out of
 *  the staff CRM bundle (only fetched when someone opens /live). */
export default function LiveRoot() {
  return (
    <HMSRoomProvider>
      <LiveApp />
    </HMSRoomProvider>
  );
}
