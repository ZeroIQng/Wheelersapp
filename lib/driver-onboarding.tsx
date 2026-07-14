import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { File } from "expo-file-system";
import { submitDriverKyc } from "@/lib/api";
import { getAccessTokenWithRetry, type AccessTokenGetter } from "@/lib/access-token";

interface OnboardingData {
  ninUri: string | null;
  licenceUri: string | null;
  selfieUri: string | null;
}

interface DriverOnboardingContextValue {
  data: OnboardingData;
  setNinUri: (uri: string) => void;
  setLicenceUri: (uri: string) => void;
  setSelfieUri: (uri: string) => void;
  submit: (vehicle: { make: string; model: string; plate: string; year: number }, getAccessToken: AccessTokenGetter) => Promise<void>;
  submitting: boolean;
}

const DriverOnboardingContext = createContext<DriverOnboardingContextValue | null>(null);

export function useDriverOnboarding() {
  const ctx = useContext(DriverOnboardingContext);
  if (!ctx) throw new Error("useDriverOnboarding must be inside DriverOnboardingProvider");
  return ctx;
}

async function uriToBase64(uri: string): Promise<string> {
  const file = new File(uri);
  return file.base64();
}

export function DriverOnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>({
    ninUri: null,
    licenceUri: null,
    selfieUri: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const setNinUri = useCallback((uri: string) => {
    setData((prev) => ({ ...prev, ninUri: uri }));
  }, []);

  const setLicenceUri = useCallback((uri: string) => {
    setData((prev) => ({ ...prev, licenceUri: uri }));
  }, []);

  const setSelfieUri = useCallback((uri: string) => {
    setData((prev) => ({ ...prev, selfieUri: uri }));
  }, []);

  const submit = useCallback(async (
    vehicle: { make: string; model: string; plate: string; year: number },
    getAccessToken: AccessTokenGetter,
  ) => {
    if (!data.ninUri || !data.licenceUri || !data.selfieUri) {
      throw new Error("All documents must be captured before submitting.");
    }

    setSubmitting(true);
    try {
      const accessToken = await getAccessTokenWithRetry(getAccessToken);
      if (!accessToken) throw new Error("Not authenticated.");

      const [ninImage, licenceImage, selfieImage] = await Promise.all([
        uriToBase64(data.ninUri),
        uriToBase64(data.licenceUri),
        uriToBase64(data.selfieUri),
      ]);

      await submitDriverKyc({
        accessToken,
        ninImage,
        licenceImage,
        selfieImage,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
        vehicleYear: vehicle.year,
      });
    } finally {
      setSubmitting(false);
    }
  }, [data]);

  return (
    <DriverOnboardingContext.Provider value={{ data, setNinUri, setLicenceUri, setSelfieUri, submit, submitting }}>
      {children}
    </DriverOnboardingContext.Provider>
  );
}
