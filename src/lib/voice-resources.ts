export function releaseVoiceResources(resources: {
  channel: RTCDataChannel | null;
  peer: RTCPeerConnection | null;
  microphone: MediaStream | null;
  audio: HTMLAudioElement | null;
}) {
  if (resources.channel) {
    resources.channel.onopen = null;
    resources.channel.onclose = null;
    resources.channel.onmessage = null;
    resources.channel.close();
  }
  if (resources.peer) {
    resources.peer.onconnectionstatechange = null;
    resources.peer.ontrack = null;
    resources.peer.close();
  }
  resources.microphone?.getTracks().forEach(track => track.stop());
  if (resources.audio) {
    resources.audio.pause();
    resources.audio.srcObject = null;
  }
}
export function stopLateMicrophone(stream: MediaStream, expected: number, current: number) {
  if (expected === current) return false;
  stream.getTracks().forEach(track => track.stop());
  return true;
}
