import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { AnnulmentsPage } from './AnnulmentsPage';

afterEach(()=>vi.unstubAllGlobals());

describe('AnnulmentsPage',()=>{
  it('mantiene visible la venta original y muestra efectos compensatorios',async()=>{
    vi.stubGlobal('fetch',vi.fn((input:RequestInfo|URL)=>{
      const path=String(input);const body=path.endsWith('/annulments')?[{id:'a-1',saleId:'s-1',documentNumber:'V-1',routeCode:'R-1',routeName:'Centro',customerName:'Cliente',saleTotal:100,status:'APPROVED',reason:'Error',requestedByUsername:'seller',decidedByUsername:'admin',effects:[{effectType:'PAYMENT_REVERSAL',paymentMethod:'CASH',amount:100},{effectType:'INVENTORY_RESTORE',productName:'Agua',quantityBaseUnits:10}]}]:path.endsWith('/sales')?[{id:'s-1',documentNumber:'V-1',customerName:'Cliente',total:100}]:[];
      return Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
    }));
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AnnulmentsPage canRequest canDecide/></QueryClientProvider>);
    expect(screen.getByRole('heading',{name:'Anulaciones'})).toBeInTheDocument();
    expect(await screen.findByText(/Venta original V-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Reversión CASH.*Q100/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventario restaurado.*10/i)).toBeInTheDocument();
    expect(screen.queryByText(/venta eliminada/i)).not.toBeInTheDocument();
  });
});
