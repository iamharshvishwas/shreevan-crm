import { HMSRoomProvider } from '@100mslive/react-sdk';
import { TeachApp } from './TeachApp';

/** Default export for lazy-loading — keeps the 100ms SDK out of the CRM bundle. */
export default function TeachRoot() {
  return (
    <HMSRoomProvider>
      <TeachApp />
    </HMSRoomProvider>
  );
}
