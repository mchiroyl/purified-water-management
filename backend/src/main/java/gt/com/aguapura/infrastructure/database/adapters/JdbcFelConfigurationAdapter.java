package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.FelConfigurationPort;
import gt.com.aguapura.application.ports.AuditMetadataPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

@Repository
public class JdbcFelConfigurationAdapter implements FelConfigurationPort {
    private final JdbcClient jdbc;
    private final AuditMetadataPort auditMetadata;

    public JdbcFelConfigurationAdapter(JdbcClient jdbc, AuditMetadataPort auditMetadata) {
        this.jdbc = jdbc;
        this.auditMetadata = auditMetadata;
    }

    @Override
    public Configuration get() {
        return jdbc.sql("""
                SELECT id,enabled,COALESCE(provider_code,'') provider_code,
                       credential_secret_ref IS NOT NULL AND length(trim(credential_secret_ref))>0 credentials_configured,
                       environment,COALESCE(establishment_code,'') establishment_code,version,updated_at
                FROM fel_configuration WHERE singleton_key
                """).query((rs, row) -> row(rs)).single();
    }

    @Override
    public Configuration update(Update item) {
        int changed = jdbc.sql("""
                UPDATE fel_configuration SET enabled=:enabled,provider_code=NULLIF(:provider,''),
                    environment=:environment,establishment_code=NULLIF(:establishment,''),
                    updated_by=:actor,updated_at=now(),version=version+1
                WHERE singleton_key AND version=:version
                """).param("enabled", item.enabled()).param("provider", item.providerCode())
                .param("environment", item.environment()).param("establishment", item.establishmentCode())
                .param("actor", item.actorId()).param("version", item.version()).update();
        if (changed != 1) throw new BusinessException("FEL_CONFIGURATION_CONFLICT",
                "La configuración FEL cambió; recargue antes de guardar.", ErrorCategory.CONFLICT);
        var current = get();
        jdbc.sql("""
                INSERT INTO audit_log(user_id,device_id,action,entity_type,entity_id,after_data,correlation_id,ip_address)
                VALUES (:actor,:device,'FEL_CONFIGURATION_UPDATED','FEL_CONFIGURATION',:id,
                        jsonb_build_object('enabled',:enabled,'providerCode',:provider,'environment',:environment),:correlation,:ip)
                """).param("actor", item.actorId()).param("device", item.deviceId()).param("id", current.id())
                .param("enabled", current.enabled()).param("provider", current.providerCode())
                .param("environment", current.environment()).param("correlation", auditMetadata.current().correlationId())
                .param("ip", auditMetadata.current().ipAddress()).update();
        return current;
    }

    private Configuration row(ResultSet rs) throws SQLException {
        return new Configuration(rs.getObject("id", UUID.class), rs.getBoolean("enabled"),
                rs.getString("provider_code"), rs.getBoolean("credentials_configured"),
                rs.getString("environment"), rs.getString("establishment_code"), rs.getLong("version"),
                rs.getTimestamp("updated_at").toInstant());
    }
}
