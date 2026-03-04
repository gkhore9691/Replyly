"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "IGNORED", label: "Ignored" },
] as const;

interface Member {
  id: string;
  name: string | null;
  email: string;
}

interface Assignment {
  id: string;
  assigneeId: string;
  status: string;
  assignee: { id: string; name: string | null; email: string };
}

export function ErrorAssignmentCard({
  projectId,
  errorHash,
}: {
  projectId: string;
  errorHash: string;
}) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("OPEN");

  const encodedHash = encodeURIComponent(errorHash);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [assignRes, membersRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/error-groups/${encodedHash}/assign`),
          fetch(`/api/projects/${projectId}/members`),
        ]);
        const assignData = await assignRes.json();
        const membersData = await membersRes.json();
        if (!cancelled) {
          if (assignRes.ok && assignData.assignment) {
            setAssignment(assignData.assignment);
            setSelectedAssignee(assignData.assignment.assigneeId);
            setSelectedStatus(assignData.assignment.status);
          }
          if (membersRes.ok && membersData.members) {
            setMembers(membersData.members);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [projectId, encodedHash]);

  async function handleAssign() {
    if (!selectedAssignee) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/error-groups/${encodedHash}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigneeId: selectedAssignee,
            status: selectedStatus,
          }),
        }
      );
      const data = await res.json();
      if (res.ok && data.assignment) {
        setAssignment(data.assignment);
      }
    } finally {
      setAssigning(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSelectedStatus(newStatus);
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/error-groups/${encodedHash}/assign`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await res.json();
      if (res.ok && data.assignment) {
        setAssignment(data.assignment);
      }
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Assignee</label>
          <Select
            value={selectedAssignee || "none"}
            onValueChange={(v) => setSelectedAssignee(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={selectedStatus}
            onValueChange={(v) => {
              if (assignment) {
                handleStatusChange(v);
              } else {
                setSelectedStatus(v);
              }
            }}
            disabled={assigning}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={handleAssign}
          disabled={assigning || !selectedAssignee}
        >
          {assigning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Assign"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
