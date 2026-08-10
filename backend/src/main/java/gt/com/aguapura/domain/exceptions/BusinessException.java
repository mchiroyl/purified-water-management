package gt.com.aguapura.domain.exceptions;

public class BusinessException extends RuntimeException {

    private final String code;
    private final ErrorCategory category;

    public BusinessException(String code, String message, ErrorCategory category) {
        super(message);
        this.code = code;
        this.category = category;
    }

    public String code() {
        return code;
    }

    public ErrorCategory category() {
        return category;
    }
}
