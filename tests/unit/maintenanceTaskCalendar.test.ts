import {test} from "node:test";
import assert from "node:assert/strict";
import {taskAppointmentId, taskCalendarEntry, maintenanceTaskTitle} from "../../src/services/maintenanceTaskCalendarLogic.ts";
import {emptyAppointment} from "../../src/services/maintenanceAppointmentLogic.ts";
import type {MaintenanceTask} from "../../src/services/maintenanceTaskStore.ts";
test("task schedules reuse one stable relationship and derive current task fields without storing them",()=>{
 const taskId="source-maintenance-task-001", id=taskAppointmentId(taskId);
 assert.equal(taskAppointmentId(taskId),id);
 const record={...emptyAppointment("2026-10-22"),id,taskId,revision:1};
 const task={id:taskId,description:"Service the boiler\nDetailed instructions",assigneeName:"Current leader",status:"open"} as MaintenanceTask;
 const first=taskCalendarEntry(record,task);
 assert.equal(first.title,"Service the boiler"); assert.match(first.detail!,/Current leader · Open/); assert.equal(first.path,`/maintenance/tasks/${taskId}`);
 const updated=taskCalendarEntry(record,{...task,description:"Revised task",assigneeName:"New leader",status:"complete"});
 assert.equal(updated.id,first.id); assert.equal(updated.title,"Revised task"); assert.match(updated.detail!,/New leader · Complete/);
 assert.equal(record.title,""); assert.equal("assigneeName" in record,false); assert.equal("status" in record,false);
});
test("long task titles wrap concisely and unavailable tasks expose no stale source fields",()=>{
 assert.equal(maintenanceTaskTitle("X".repeat(300)).length,80);
 assert.equal(maintenanceTaskTitle(" \n "),"Maintenance task");
 const missing=taskCalendarEntry({...emptyAppointment("2026-10-22"),id:"task-missing",taskId:"missing",revision:1},null);
 assert.equal(missing.title,"Maintenance task unavailable"); assert.equal(missing.detail,"Source task unavailable");
});
