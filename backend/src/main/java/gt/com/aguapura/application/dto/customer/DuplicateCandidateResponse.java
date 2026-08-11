package gt.com.aguapura.application.dto.customer;

import java.util.UUID;

public record DuplicateCandidateResponse(UUID id, String code, String name, String phone, String whatsapp) {
}
