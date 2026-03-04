import { AlertRuleForm } from "@/components/dashboard/alerts/AlertRuleForm";

export default async function EditAlertRulePage({
  params,
}: {
  params: Promise<{ projectId: string; ruleId: string }>;
}) {
  const { projectId, ruleId } = await params;
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] tracking-wider">( EDIT ALERT RULE )</p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-[var(--fg)]">Edit Alert Rule</h1>
      </div>
      <AlertRuleForm projectId={projectId} ruleId={ruleId} />
    </div>
  );
}
