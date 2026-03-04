import Link from "next/link";
import { AlertRulesList } from "@/components/dashboard/alerts/AlertRulesList";

export default async function AlertRulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AlertRulesList projectId={projectId} />;
}
