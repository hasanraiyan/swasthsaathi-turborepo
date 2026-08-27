import { useLocalSearchParams } from 'expo-router';

import { CallScreen } from '../components/call/CallScreen';

/** `/call?sessionId=...` -- the sessionId is a display-only link back to the chat it was started from. */
export default function Call() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  return <CallScreen sessionId={sessionId} />;
}
