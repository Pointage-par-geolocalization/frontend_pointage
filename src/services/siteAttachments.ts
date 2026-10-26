import { get, del, API_URL, getAccessToken, postForm } from "./api"
export interface SiteAttachment { id:string; name:string; mimeType:string; size:number; createdAt:string; uploadedBy?:string; url?:string; type?:string }
export const listSiteAttachments=(siteId:string)=>get<SiteAttachment[]>(`/sites/${encodeURIComponent(siteId)}/attachments`)
export const addSiteAttachment=(siteId:string,file:File, type?:string,onProgress?:(percent:number)=>void)=>{
  // FormData laisse le navigateur fixer la boundary multipart; aucun contenu base64/JSON.
  const data=new FormData(); data.append("file",file,file.name); if(type)data.append("type",type)
  onProgress?.(0)
  return postForm<SiteAttachment>(`/sites/${encodeURIComponent(siteId)}/attachments`,data).then(result=>{onProgress?.(100);return result})
}
export const deleteSiteAttachment=(siteId:string,id:string)=>del(`/sites/${encodeURIComponent(siteId)}/attachments/${encodeURIComponent(id)}`)
export function siteAttachmentUrl(siteId:string,id:string){return `${API_URL}/sites/${encodeURIComponent(siteId)}/attachments/${encodeURIComponent(id)}`}
export async function openSiteAttachment(siteId:string,id:string,name="piece-jointe") {const token=getAccessToken(); const response=await fetch(siteAttachmentUrl(siteId,id),{headers:token?{Authorization:`Bearer ${token}`}:{},credentials:"include"});if(!response.ok)throw new Error("Téléchargement impossible");const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
