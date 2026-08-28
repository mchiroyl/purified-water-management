package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.auth.*;
import gt.com.aguapura.application.ports.PasswordVerificationPort;
import gt.com.aguapura.domain.enums.UserStatus;
import gt.com.aguapura.domain.exceptions.*;
import gt.com.aguapura.infrastructure.database.entities.DeviceJpaEntity;
import gt.com.aguapura.infrastructure.database.entities.DeviceReenrollmentRequestJpaEntity;
import gt.com.aguapura.infrastructure.repositories.*;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets; import java.security.*; import java.time.*; import java.util.*;

@Service public class DeviceReenrollmentApplicationService {
 private final UserJpaRepository users; private final DeviceJpaRepository devices; private final DeviceReenrollmentRequestJpaRepository requests; private final RefreshSessionJpaRepository sessions; private final PasswordVerificationPort passwords; private final AuditApplicationService audit;
 public DeviceReenrollmentApplicationService(UserJpaRepository users,DeviceJpaRepository devices,DeviceReenrollmentRequestJpaRepository requests,RefreshSessionJpaRepository sessions,PasswordVerificationPort passwords,AuditApplicationService audit){this.users=users;this.devices=devices;this.requests=requests;this.sessions=sessions;this.passwords=passwords;this.audit=audit;}
 @Transactional public DeviceReenrollmentResponse request(DeviceReenrollmentRequest input){
  var user=users.findByUsername(input.username().trim().toLowerCase(Locale.ROOT)).orElseThrow(this::invalid);
  if(user.getStatus()!=UserStatus.ACTIVE || !passwords.matches(input.password(),user.getPasswordHash()))throw invalid();
  var pending=requests.findFirstByUserIdAndStatusOrderByCreatedAtDesc(user.getId(),"PENDING");
  if(pending.isPresent()){
   var existing=pending.get();
   if(existing.expireIfNeeded()) { requests.save(existing); audit.record(user.getId(),null,"DEVICE_REENROLLMENT_EXPIRED","DEVICE_REENROLLMENT",existing.getId(),Map.of(),Map.of()); }
   else throw conflict();
  }
  String token=token();var row=requests.save(new DeviceReenrollmentRequestJpaEntity(user.getId(),input.deviceName().trim(),hash(token),Instant.now().plus(Duration.ofMinutes(10))));audit.record(user.getId(),null,"DEVICE_REENROLLMENT_REQUESTED","DEVICE_REENROLLMENT",row.getId(),Map.of(),Map.of("deviceName",row.getRequestedName()));return response(row,token,null);
 }
 @Transactional public DeviceReenrollmentResponse status(String token){var row=find(token);if(row.expireIfNeeded()){requests.save(row);audit.record(row.getUserId(),null,"DEVICE_REENROLLMENT_EXPIRED","DEVICE_REENROLLMENT",row.getId(),Map.of(),Map.of());}return response(row,null,null);}
 @Transactional public DeviceReenrollmentResponse findForAdministrator(String token){return status(token);}
 @Transactional public DeviceReenrollmentResponse approve(UUID id,String name,UUID actor){var row=requests.findById(id).orElseThrow(this::invalid);if(row.expireIfNeeded()){requests.save(row);throw invalid();}if(!row.getStatus().equals("PENDING"))throw invalid();row.approve(actor,name.trim());requests.save(row);audit.record(actor,null,"DEVICE_REENROLLMENT_APPROVED","DEVICE_REENROLLMENT",id,Map.of(),Map.of("deviceName",name.trim(),"userId",row.getUserId().toString()));return response(row,null,null);}
 @Transactional public void reject(UUID id,UUID actor){var row=requests.findById(id).orElseThrow(this::invalid);if(row.expireIfNeeded()){requests.save(row);throw invalid();}if(!row.getStatus().equals("PENDING"))throw invalid();row.reject();requests.save(row);audit.record(actor,null,"DEVICE_REENROLLMENT_REJECTED","DEVICE_REENROLLMENT",id,Map.of(),Map.of("userId",row.getUserId().toString()));}
 @Transactional public DeviceReenrollmentResponse complete(String token){var row=find(token);if(row.expireIfNeeded()){requests.save(row);audit.record(row.getUserId(),null,"DEVICE_REENROLLMENT_EXPIRED","DEVICE_REENROLLMENT",row.getId(),Map.of(),Map.of());throw invalid();}if(!row.getStatus().equals("APPROVED"))throw invalid();sessions.revokeUserSessions(row.getUserId(),Instant.now(),"DEVICE_REENROLLED");var device=devices.save(new DeviceJpaEntity(row.getUserId(),row.getRequestedName(),"web"));row.use();requests.save(row);audit.record(row.getUserId(),device.getId(),"DEVICE_REENROLLMENT_COMPLETED","DEVICE",device.getId(),Map.of(),Map.of("requestId",row.getId().toString(),"deviceName",row.getRequestedName()));return response(row,null,device.getId());}
 @Transactional(readOnly=true) public List<DeviceReenrollmentResponse> list(){return requests.findAllByOrderByCreatedAtDesc().stream().map(x->response(x,null,null)).toList();}
 private DeviceReenrollmentRequestJpaEntity find(String token){return requests.findByTokenHash(hash(token)).orElseThrow(this::invalid);} private DeviceReenrollmentResponse response(DeviceReenrollmentRequestJpaEntity x,String token,UUID deviceId){String username=users.findById(x.getUserId()).map(user->user.getUsername()).orElse("Usuario eliminado");return new DeviceReenrollmentResponse(x.getId(),username,token,x.getStatus(),x.getRequestedName(),x.getExpiresAt(),x.getCreatedAt(),deviceId);}
 private String token(){byte[] b=new byte[24];new SecureRandom().nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);} private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 private BusinessException invalid(){return new BusinessException("DEVICE_REENROLLMENT_INVALID","La solicitud de reinscripción no es válida.",ErrorCategory.VALIDATION);}
 private BusinessException conflict(){return new BusinessException("DEVICE_REENROLLMENT_PENDING","Ya existe una solicitud de reinscripción pendiente para este usuario.",ErrorCategory.CONFLICT);}
}
