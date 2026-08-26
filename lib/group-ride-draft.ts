export type GroupRideFaceCapture = {
  uri: string;
  mimeType: string;
  capturedAt: string;
  /**
   * The captured bytes, kept so the upload does not depend on the temporary
   * camera file still existing by the time the match request is created.
   */
  base64?: string;
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
