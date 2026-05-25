export type GroupRideFaceCapture = {
  uri: string;
  mimeType: string;
  capturedAt: string;
};

let latestFaceCapture: GroupRideFaceCapture | null = null;

export function setGroupRideFaceCapture(capture: GroupRideFaceCapture): void {
  latestFaceCapture = capture;
}

export function getGroupRideFaceCapture(): GroupRideFaceCapture | null {
  return latestFaceCapture;
}

export function clearGroupRideFaceCapture(): void {
  latestFaceCapture = null;
}
