import { NextRequest, NextResponse } from "next/server";
import { getSavedSprintTasks, saveSprintTasks } from "@/lib/connectors/opsStore";
import { SprintTask } from "@/lib/types";

export async function GET() {
  try {
    const tasks = await getSavedSprintTasks();
    return NextResponse.json({ success: true, tasks: tasks ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sprint tasks";
    return NextResponse.json({ success: false, error: message, tasks: null }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const tasks = Array.isArray(body?.tasks) ? (body.tasks as SprintTask[]) : null;
    if (!tasks) {
      return NextResponse.json({ success: false, error: "tasks array is required" }, { status: 400 });
    }

    await saveSprintTasks(tasks);
    return NextResponse.json({ success: true, count: tasks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save sprint tasks";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
