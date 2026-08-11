package gt.com.aguapura.presentation.controllers;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ConnectivityControllerTest {

    @Test
    void returnsSmallUncachedOnlineResponse() {
        var response = new ConnectivityController().connectivity();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getCacheControl()).contains("no-store");
        assertThat(response.getBody()).containsEntry("status", "ONLINE");
        assertThat(response.getBody()).containsKey("serverTime");
        assertThat(response.getBody()).hasSize(2);
    }
}
