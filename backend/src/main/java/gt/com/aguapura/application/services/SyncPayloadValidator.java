package gt.com.aguapura.application.services;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import jakarta.validation.Validator;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class SyncPayloadValidator {
    private final ObjectMapper mapper;
    private final Validator validator;

    public SyncPayloadValidator(ObjectMapper mapper, Validator validator) {
        this.mapper = mapper;
        this.validator = validator;
    }

    public <T> T read(JsonNode payload, Class<T> type, String errorCode, String errorMessage) {
        try {
            T value = mapper.treeToValue(payload, type);
            if (!validator.validate(value).isEmpty()) throw invalid(errorCode, errorMessage);
            return value;
        } catch (JacksonException | IllegalArgumentException exception) {
            throw invalid(errorCode, errorMessage);
        }
    }

    public JsonNode tree(Object value) {
        return mapper.valueToTree(value);
    }

    private BusinessException invalid(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }
}
