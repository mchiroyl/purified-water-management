package gt.com.aguapura.application.dto;

import gt.com.aguapura.application.dto.pricing.CreatePriceVersionRequest;
import gt.com.aguapura.application.dto.returns.ConfirmReturnReceiptRequest;
import gt.com.aguapura.application.dto.returns.CreateReturnRequest;
import gt.com.aguapura.application.dto.waste.CreateWasteRequest;
import gt.com.aguapura.application.dto.waste.ReviewWasteRequest;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RequestCollectionLimitsTest {

    @Test
    void allHighCostCollectionsHaveExplicitCardinalityLimits() {
        assertBounded(CreateWasteRequest.class, "items");
        assertBounded(CreateWasteRequest.class, "evidence");
        assertBounded(ReviewWasteRequest.class, "items");
        assertBounded(CreateReturnRequest.class, "items");
        assertBounded(ConfirmReturnReceiptRequest.class, "items");
        assertBounded(CreatePriceVersionRequest.class, "tiers");
    }

    private void assertBounded(Class<?> type, String name) {
        Size constraint;
        try {
            constraint = type.getMethod(name).getAnnotation(Size.class);
        } catch (NoSuchMethodException exception) {
            throw new AssertionError(exception);
        }
        assertThat(constraint)
                .as(type.getSimpleName() + "." + name)
                .isNotNull()
                .extracting(Size::max)
                .isEqualTo(100);
    }
}
