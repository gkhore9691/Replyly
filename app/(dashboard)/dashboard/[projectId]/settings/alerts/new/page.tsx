import { AlertRuleForm } from "@/components/dashboard/alerts/AlertRuleForm";

export default async function NewAlertRulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">( NEW ALERT RULE )</p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">New Alert Rule</h1>
      </div>
      <AlertRuleForm projectId={projectId} />
    </div>
  );
}
