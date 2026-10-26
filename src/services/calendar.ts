import { del, get, post, put } from "./api"
export interface Holiday { id:string; date:string; name:string; workday?:boolean; createdAt?:string }
export interface CalendarSettings { workDays:number[]; startTime?:string; endTime?:string; toleranceMinutes:number }
export const listHolidays = (from?:string,to?:string) => get<Holiday[]>("/calendar/holidays",{from,to})
export const createHoliday = (data:Omit<Holiday,"id">) => post<Holiday>("/calendar/holidays",data)
export const updateHoliday = (id:string,data:Partial<Holiday>) => put<Holiday>(`/calendar/holidays/${encodeURIComponent(id)}`,data)
export const deleteHoliday = (id:string) => del(`/calendar/holidays/${encodeURIComponent(id)}`)
export const getCalendarSettings = () => get<CalendarSettings>("/calendar/settings")
export const saveCalendarSettings = (data:CalendarSettings) => put<CalendarSettings>("/calendar/settings",data)
