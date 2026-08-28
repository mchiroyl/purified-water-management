package gt.com.aguapura.infrastructure.database.entities;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "device_reenrollment_request")
public class DeviceReenrollmentRequestJpaEntity {
    @Id @GeneratedValue private UUID id;
    @Column(name="user_id", nullable=false) private UUID userId;
    @Column(name="requested_name", nullable=false, length=100) private String requestedName;
    @Column(name="token_hash", nullable=false, unique=true, length=64) private String tokenHash;
    @Column(nullable=false, length=20) private String status = "PENDING";
    @Column(name="expires_at", nullable=false) private Instant expiresAt;
    @Column(name="approved_by") private UUID approvedBy;
    @Column(name="approved_at") private Instant approvedAt;
    @Column(name="used_at") private Instant usedAt;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    protected DeviceReenrollmentRequestJpaEntity() {}
    public DeviceReenrollmentRequestJpaEntity(UUID userId,String requestedName,String tokenHash,Instant expiresAt){this.userId=userId;this.requestedName=requestedName;this.tokenHash=tokenHash;this.expiresAt=expiresAt;}
    @PrePersist void created(){createdAt=Instant.now();}
    public UUID getId(){return id;} public UUID getUserId(){return userId;} public String getRequestedName(){return requestedName;} public String getTokenHash(){return tokenHash;} public String getStatus(){return status;} public Instant getExpiresAt(){return expiresAt;} public Instant getCreatedAt(){return createdAt;}
    public boolean expireIfNeeded(){if(status.equals("PENDING") && !expiresAt.isAfter(Instant.now())){status="EXPIRED";return true;}return false;}
    public void approve(UUID actor,String name){status="APPROVED";approvedBy=actor;approvedAt=Instant.now();requestedName=name;}
    public void reject(){status="REJECTED";} public void use(){status="USED";usedAt=Instant.now();}
}
