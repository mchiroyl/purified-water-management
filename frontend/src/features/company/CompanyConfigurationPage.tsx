import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiRequest } from '../../services/apiClient';

const schema = z.object({
  commercialName: z.string().min(2).max(150),
  legalName: z.string().min(2).max(200),
  taxId: z.string().min(3).max(30),
  address: z.string().min(5).max(500),
  phone: z.string().max(30),
  whatsapp: z.string().max(30),
  email: z.email().or(z.literal('')),
  currencyCode: z.string().length(3),
  timezone: z.string().min(3).max(80),
  receiptPrefix: z.string().min(1).max(20),
  documentLegend: z.string().max(500)
});

type CompanyForm = z.infer<typeof schema>;
type CompanyResponse = CompanyForm & { id: string; version: number };

export function CompanyConfigurationPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['company-configuration'], queryFn: () => apiRequest<CompanyResponse>('/company-configuration') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyForm>({
    resolver: zodResolver(schema),
    defaultValues: { currencyCode: 'GTQ', timezone: 'America/Guatemala', receiptPrefix: 'V', phone: '', whatsapp: '', email: '', documentLegend: '' }
  });
  useEffect(() => { if (query.data) reset(query.data); }, [query.data, reset]);
  const mutation = useMutation({
    mutationFn: (data: CompanyForm) => apiRequest<CompanyResponse>('/company-configuration', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.setQueryData(['company-configuration'], data);
      setMessage('Datos guardados correctamente.');
    }
  });

  return (
    <main>
      <p className="eyebrow">Configuración</p>
      <h1>Datos de la empresa</h1>
      <p className="muted">Esta información se utilizará en la aplicación y en todos los comprobantes.</p>
      <form className="form-grid panel" onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate>
        <label>Nombre comercial<input {...register('commercialName')} /></label>
        <label>Razón social<input {...register('legalName')} /></label>
        <label>NIT<input {...register('taxId')} /></label>
        <label className="wide">Dirección<textarea {...register('address')} /></label>
        <label>Teléfono<input {...register('phone')} /></label>
        <label>WhatsApp<input {...register('whatsapp')} /></label>
        <label>Correo<input type="email" {...register('email')} /></label>
        <label>Moneda<input {...register('currencyCode')} /></label>
        <label>Zona horaria<input {...register('timezone')} /></label>
        <label>Prefijo de comprobantes<input {...register('receiptPrefix')} /></label>
        <label className="wide">Texto para documentos<textarea {...register('documentLegend')} /></label>
        {Object.keys(errors).length > 0 && <div className="alert error wide">Revisa los campos marcados.</div>}
        {mutation.error && <div className="alert error wide">{mutation.error.message}</div>}
        {message && <div className="alert success wide">{message}</div>}
        <button className="primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar configuración'}</button>
      </form>
    </main>
  );
}
