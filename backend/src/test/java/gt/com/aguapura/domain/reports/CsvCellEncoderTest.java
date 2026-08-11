package gt.com.aguapura.domain.reports;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CsvCellEncoderTest {
    @Test
    void preventsSpreadsheetFormulaInjectionAndEscapesQuotes() {
        assertThat(CsvCellEncoder.encode("=HYPERLINK(\"bad\")"))
                .isEqualTo("\"'=HYPERLINK(\"\"bad\"\")\"");
        assertThat(CsvCellEncoder.encode("Ruta, norte")).isEqualTo("\"Ruta, norte\"");
    }
}
