package gt.com.aguapura.application.services;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ReturnSyncHandlerTest {
    @Test
    void onlyHandlesCreationOfReturnAggregates() {
        var handler = new ReturnSyncHandler(mock(ReturnApplicationService.class), mock(SyncPayloadValidator.class));

        assertThat(handler.supports("RETURN", "CREATE")).isTrue();
        assertThat(handler.supports("RETURN", "UPDATE")).isFalse();
        assertThat(handler.supports("WASTE", "CREATE")).isFalse();
    }
}
