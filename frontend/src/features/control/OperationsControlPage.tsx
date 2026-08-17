import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../app/PageHeader';
import { useState, type FormEvent } from 'react';
import { apiRequest } from '../../services/apiClient';

type Authorization = { id: string; authorizationType: string; entityType: string; entityId: string;
  requestedByUsername: string; reason: string; status: string; expiresAt: string; decidedByUsername?: string;
  decisionNotes?: string };
type Incident = { id: string; routeCode?: string; routeName?: string; incidentType: string; severity: string;
  status: string; description: string; reportedByUsername: string; handledByUsername?: string; resolutionNotes?: string };
type Route = { id: string; code: string; name: string; status: string };

const authorizationLabels: Record<string, string> = { REQUESTED: 'Solicitud pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada', EXPIRED: 'Expirada' };
const incidentLabels: Record<string, string> = { OPEN: 'Incidencia abierta', INVESTIGATING: 'En investigación', RESOLVED: 'Resuelta', DISMISSED: 'Descartada' };
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

export function OperationsControlPage({ canDecide }: { canDecide: boolean }) {
  const client=useQueryClient();
  const authorizations=useQuery({ queryKey: ['operations-control','authorizations'], queryFn: () => apiRequest<Authorization[]>('/operations-control/authorizations') });
  const incidents=useQuery({ queryKey: ['operations-control','incidents'], queryFn: () => apiRequest<Incident[]>('/operations-control/incidents') });
  const routes=useQuery({ queryKey: ['routes'], queryFn: () => apiRequest<Route[]>('/routes') });
  const [authorization,setAuthorization]=useState({ authorizationType:'LOAD_CORRECTION',entityType:'ROUTE_LOAD',entityId:'',reason:'',expiresAt:tomorrow() });
  const [incident,setIncident]=useState({ routeId:'',incidentType:'ROUTE',severity:'MEDIUM',description:'' });
  const [decisionNotes,setDecisionNotes]=useState<Record<string,string>>({});
  const [resolutionNotes,setResolutionNotes]=useState<Record<string,string>>({});
  const refresh=async()=>{await client.invalidateQueries({queryKey:['operations-control']});};
  const request=useMutation({mutationFn:()=>apiRequest<Authorization>('/operations-control/authorizations',{method:'POST',body:JSON.stringify({...authorization,expiresAt:new Date(authorization.expiresAt).toISOString()})}),onSuccess:async()=>{setAuthorization(current=>({...current,entityId:'',reason:''}));await refresh();}});
  const decide=useMutation({mutationFn:({id,decision}:{id:string;decision:'APPROVE'|'REJECT'})=>apiRequest<Authorization>(`/operations-control/authorizations/${id}/decision`,{method:'POST',body:JSON.stringify({decision,notes:decisionNotes[id]||`${decision==='APPROVE'?'Autorización comprobada':'Solicitud rechazada'} por revisión`})}),onSuccess:refresh});
  const report=useMutation({mutationFn:()=>apiRequest<Incident>('/operations-control/incidents',{method:'POST',body:JSON.stringify({...incident,settlementId:null,referenceType:null,referenceId:null})}),onSuccess:async()=>{setIncident(current=>({...current,description:''}));await refresh();}});
  const act=useMutation({mutationFn:({id,action}:{id:string;action:'INVESTIGATE'|'RESOLVE'|'DISMISS'})=>apiRequest<Incident>(`/operations-control/incidents/${id}/actions`,{method:'POST',body:JSON.stringify({action,notes:resolutionNotes[id]||`${action==='RESOLVE'?'Causa y solución verificadas':'Incidencia revisada'}`})}),onSuccess:refresh});
  const submitAuthorization=(event:FormEvent)=>{event.preventDefault();request.mutate();};
  const submitIncident=(event:FormEvent)=>{event.preventDefault();report.mutate();};

  return <main>
    <PageHeader eyebrow="Control segregado" title="Autorizaciones e incidencias" description="Quien solicita o reporta no puede decidir su propio caso. Las decisiones expiran y quedan auditadas." />
    <div className="dual-panels">
      <form className="panel section-panel" onSubmit={submitAuthorization}><h2>Nueva solicitud</h2><div className="form-grid compact-grid">
        <label>Tipo<select value={authorization.authorizationType} onChange={event=>setAuthorization({...authorization,authorizationType:event.target.value})}><option value="LOAD_CORRECTION">Corrección de carga</option><option value="SETTLEMENT_DIFFERENCE">Liquidación con diferencia</option><option value="CREDIT_LIMIT_CHANGE">Cambio de límite</option><option value="OTHER_OPERATION">Otra operación</option></select></label>
        <label>Recurso<select value={authorization.entityType} onChange={event=>setAuthorization({...authorization,entityType:event.target.value})}><option value="ROUTE_LOAD">Carga</option><option value="SETTLEMENT">Liquidación</option><option value="CUSTOMER">Cliente</option><option value="SALE">Venta</option></select></label>
        <label>UUID del recurso<input required value={authorization.entityId} onChange={event=>setAuthorization({...authorization,entityId:event.target.value})}/></label>
        <label>Vence<input required type="datetime-local" value={authorization.expiresAt} onChange={event=>setAuthorization({...authorization,expiresAt:event.target.value})}/></label>
        <label className="full-width">Motivo<textarea required value={authorization.reason} onChange={event=>setAuthorization({...authorization,reason:event.target.value})}/></label>
      </div><button className="primary">Enviar solicitud</button></form>
      <form className="panel section-panel" onSubmit={submitIncident}><h2>Reportar incidencia</h2><div className="form-grid compact-grid">
        <label>Ruta<select required value={incident.routeId} onChange={event=>setIncident({...incident,routeId:event.target.value})}><option value="">Seleccionar</option>{routes.data?.filter(route=>route.status==='ACTIVE').map(route=><option value={route.id} key={route.id}>{route.code} · {route.name}</option>)}</select></label>
        <label>Tipo<select value={incident.incidentType} onChange={event=>setIncident({...incident,incidentType:event.target.value})}><option value="CASH_DIFFERENCE">Diferencia de efectivo</option><option value="PHYSICAL_DIFFERENCE">Diferencia física</option><option value="INVENTORY">Inventario</option><option value="ROUTE">Ruta</option><option value="CUSTOMER">Cliente</option><option value="DEVICE">Dispositivo</option><option value="OTHER">Otra</option></select></label>
        <label>Severidad<select value={incident.severity} onChange={event=>setIncident({...incident,severity:event.target.value})}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></label>
        <label className="full-width">Descripción<textarea required value={incident.description} onChange={event=>setIncident({...incident,description:event.target.value})}/></label>
      </div><button className="primary">Registrar incidencia</button></form>
    </div>
    <section className="section-panel"><div className="section-heading"><h2>Solicitudes</h2><span>{authorizations.data?.length??0}</span></div><div className="sales-grid">{authorizations.data?.map(item=><article className="panel sale-card" key={item.id}><div className="section-heading"><div><strong>{item.authorizationType} · {item.entityType}</strong><span>{item.requestedByUsername}</span></div><span className="status-pill">{authorizationLabels[item.status]??item.status}</span></div><p>{item.reason}</p><p className="status-note">Vence: {new Date(item.expiresAt).toLocaleString('es-GT')}</p>{canDecide&&item.status==='REQUESTED'&&<div className="review-box"><label>Notas<input value={decisionNotes[item.id]??''} onChange={event=>setDecisionNotes(current=>({...current,[item.id]:event.target.value}))}/></label><div className="form-actions"><button className="secondary" onClick={()=>decide.mutate({id:item.id,decision:'REJECT'})}>Rechazar</button><button className="primary" onClick={()=>decide.mutate({id:item.id,decision:'APPROVE'})}>Aprobar</button></div></div>}</article>)}</div></section>
    <section className="section-panel"><div className="section-heading"><h2>Incidencias</h2><span>{incidents.data?.length??0}</span></div><div className="sales-grid">{incidents.data?.map(item=><article className="panel sale-card" key={item.id}><div className="section-heading"><div><strong>{item.incidentType} · {item.severity}</strong><span>{item.routeCode} · {item.routeName} · {item.reportedByUsername}</span></div><span className="status-pill">{incidentLabels[item.status]??item.status}</span></div><p>{item.description}</p>{canDecide&&['OPEN','INVESTIGATING'].includes(item.status)&&<div className="review-box"><label>Conclusión<input value={resolutionNotes[item.id]??''} onChange={event=>setResolutionNotes(current=>({...current,[item.id]:event.target.value}))}/></label><div className="form-actions">{item.status==='OPEN'&&<button className="secondary" onClick={()=>act.mutate({id:item.id,action:'INVESTIGATE'})}>Investigar</button>}<button className="primary" onClick={()=>act.mutate({id:item.id,action:'RESOLVE'})}>Resolver</button></div></div>}</article>)}</div></section>
  </main>;
}
