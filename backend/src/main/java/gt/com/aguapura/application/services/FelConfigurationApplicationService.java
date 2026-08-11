package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.fel.FelConfigurationRequest;
import gt.com.aguapura.application.dto.fel.FelConfigurationResponse;
import gt.com.aguapura.application.ports.FelConfigurationPort;
import gt.com.aguapura.application.ports.FelProviderPort;
import gt.com.aguapura.domain.fel.FelActivationPolicy;
import gt.com.aguapura.infrastructure.configuration.FelProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class FelConfigurationApplicationService {
    private final FelConfigurationPort persistence;
    private final FelProperties properties;
    private final List<FelProviderPort> providers;

    public FelConfigurationApplicationService(FelConfigurationPort persistence, FelProperties properties,
                                              List<FelProviderPort> providers) {
        this.persistence = persistence;
        this.properties = properties;
        this.providers = List.copyOf(providers);
    }

    @Transactional(readOnly = true)
    public FelConfigurationResponse get() {
        return response(persistence.get());
    }

    @Transactional
    public FelConfigurationResponse update(FelConfigurationRequest request, UUID actorId, UUID deviceId) {
        String providerCode = clean(request.providerCode());
        var provider = providers.stream().filter(item -> item.providerCode().equals(providerCode)).findFirst();
        boolean credentialsConfigured = credentialsConfigured(providerCode);
        FelActivationPolicy.validate(request.enabled(), providerCode, provider.isPresent(), credentialsConfigured);
        if (request.enabled() && !provider.orElseThrow().validateCredentials(properties.credentialSecretRef(),
                request.environment(), clean(request.establishmentCode()))) {
            FelActivationPolicy.validate(true, providerCode, true, false);
        }
        return response(persistence.update(new FelConfigurationPort.Update(request.enabled(), providerCode,
                request.environment(), clean(request.establishmentCode()), request.version(), actorId, deviceId)));
    }

    private FelConfigurationResponse response(FelConfigurationPort.Configuration item) {
        boolean installed = providers.stream().anyMatch(provider -> provider.providerCode().equals(item.providerCode()));
        boolean credentials = credentialsConfigured(item.providerCode());
        boolean available = installed && credentials;
        String message = item.enabled() ? "FEL activo con certificador validado."
                : available ? "FEL disponible, pendiente de activación administrativa."
                : "FEL desactivado: no hay certificador real y credenciales validadas. Los comprobantes internos continúan disponibles.";
        return new FelConfigurationResponse(item.id(), item.enabled(), item.providerCode(), item.environment(),
                item.establishmentCode(), installed, credentials, available, message, item.version(), item.updatedAt());
    }

    private boolean credentialsConfigured(String providerCode) {
        return providerCode != null && !providerCode.isBlank()
                && providerCode.equals(clean(properties.providerCode()))
                && properties.credentialSecretRef() != null && !properties.credentialSecretRef().isBlank();
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
