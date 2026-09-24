import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { AdminActionForm, AdminActionSwitch } from "@/components/admin/admin-action";
import { requireAdminPage } from "@/server/auth/session";
import { DEFAULT_MATCH_WEIGHTS, getSetting } from "@/server/settings";
import { getMatchWeights } from "@/server/matching/weights";
import { FACTOR_LABELS, bpsToPercentLabel } from "@/server/admin/utils";
import { FACTOR_KEYS } from "@/server/matching/types";
import { WeightsForm } from "./weights-form";
import { saveMatchWeightsAction, savePlatformFeeAction, saveRecommendationSettingsAction, setProEnabledAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdminPage("settings.manage");
  const [weights, limit, cooldown, feeBps, pro] = await Promise.all([
    getMatchWeights(),
    getSetting("daily_recommendation_limit"),
    getSetting("pass_cooldown_days"),
    getSetting("platform_fee_bps"),
    getSetting("pro_enabled"),
  ]);

  return (
    <>
      <PageHeader title="Platform settings" description="Changes apply platform-wide within about 30 seconds and are recorded in the audit log." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Cofounder matching weights</CardTitle>
              <p className="mt-1 text-[13px] text-muted">Relative importance of each factor. Weights are normalised, so only their proportions matter.</p>
            </div>
          </CardHeader>
          <CardContent>
            <WeightsForm factors={FACTOR_KEYS.map((key) => ({ key, label: FACTOR_LABELS[key] }))} initial={weights} defaults={{ ...DEFAULT_MATCH_WEIGHTS }} action={saveMatchWeightsAction} />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminActionForm action={saveRecommendationSettingsAction} submitLabel="Save" success="Recommendation settings saved">
                <div className="grid gap-4">
                  <Field label="People per day" htmlFor="s-limit" hint="1–20. The product promise is five.">
                    <Input id="s-limit" name="daily_recommendation_limit" type="number" min={1} max={20} defaultValue={limit} required />
                  </Field>
                  <Field label="Pass cooldown (days)" htmlFor="s-cooldown" hint="How long before someone you passed on can be recommended again.">
                    <Input id="s-cooldown" name="pass_cooldown_days" type="number" min={0} max={365} defaultValue={cooldown} required />
                  </Field>
                </div>
              </AdminActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Marketplace commission</CardTitle>
                <p className="mt-1 text-[13px] text-muted">
                  Currently <span className="font-medium text-foreground">{bpsToPercentLabel(feeBps)}</span> of each booking. Applies to new bookings only.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <AdminActionForm action={savePlatformFeeAction} submitLabel="Save commission" success="Commission updated">
                <Field label="Fee in basis points" htmlFor="s-fee" hint="0–3000 · 100 bps = 1% · 1000 bps = 10%">
                  <Input id="s-fee" name="platform_fee_bps" type="number" min={0} max={3000} step={1} defaultValue={feeBps} required />
                </Field>
              </AdminActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">You&amp;Me Pro</p>
                <p className="mt-0.5 text-[13px] text-muted">Paid tiers stay off unless this is enabled. Turning it on exposes Pro entitlements to members.</p>
                {pro && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-warning">
                    <AlertTriangle className="size-3.5" aria-hidden /> Pro is enabled — make sure billing is configured.
                  </p>
                )}
              </div>
              <AdminActionSwitch action={setProEnabledAction} payload={{}} checked={pro} label="Enable You&Me Pro" success={(on) => (on ? "Pro enabled" : "Pro disabled")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
