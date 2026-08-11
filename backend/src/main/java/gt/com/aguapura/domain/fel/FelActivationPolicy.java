package gt.com.aguapura.domain.fel;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

public final class FelActivationPolicy {
    private FelActivationPolicy() {
    }

    public static void validate(boolean enabled, String providerCode,
                                boolean providerAdapterInstalled, boolean credentialsConfigured) {
        if (!enabled) return;
        if (providerCode == null || providerCode.isBlank() || !providerAdapterInstalled) {
            throw new BusinessException("FEL_PROVIDER_UNAVAILABLE",
                    "No existe un certificador FEL real instalado y validado.", ErrorCategory.CONFLICT);
        }
        if (!credentialsConfigured) {
            throw new BusinessException("FEL_CREDENTIALS_UNAVAILABLE",
                    "Las credenciales FEL no están configuradas en el servidor.", ErrorCategory.CONFLICT);
        }
    }
}
