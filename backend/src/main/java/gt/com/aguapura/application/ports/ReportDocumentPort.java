package gt.com.aguapura.application.ports;

import java.util.List;

public interface ReportDocumentPort {
    byte[] excel(String title, CompanyConfigurationPersistencePort.CompanyData company,
                 String filterSummary, List<String> headers, List<List<String>> rows);

    byte[] pdf(String title, CompanyConfigurationPersistencePort.CompanyData company,
               String filterSummary, List<String> headers, List<List<String>> rows);
}
